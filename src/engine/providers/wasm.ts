import type { BestMoves, EngineOptions, GoMode } from "@/bindings";
import { emitBestMoves } from "@/utils/webEvents";

// Simple UCI wrapper around the worker
export class WasmEngineProvider {
  private worker: Worker | null = null;
  private handlers: Array<(line: string) => void> = [];

  constructor() {}

  onLine(cb: (line: string) => void) {
    this.handlers.push(cb);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== cb);
    };
  }

  async ensureReady() {
    if (this.worker) return;
    const wasmSupported = typeof WebAssembly === "object" && typeof WebAssembly.validate === "function" && WebAssembly.validate(new Uint8Array([0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    const scriptUrl = wasmSupported ? "/wasm/stockfish.wasm.js" : "/wasm/stockfish.js";
    // eslint-disable-next-line no-console
    try { console.info("[WASM] starting worker", { scriptUrl }); } catch {}
    this.worker = new Worker(scriptUrl, { type: "classic" });
    this.worker.onmessage = (e: MessageEvent<any>) => {
      const line = String(e.data ?? "");
      // eslint-disable-next-line no-console
      try {
        if (line.startsWith("info ") || line.startsWith("bestmove") || line === "uciok" || line === "readyok") {
          // console.debug("[WASM<-]", line);
        }
      } catch {}
      for (const h of this.handlers) h(line);
    };
  }

  async send(cmd: string) {
    await this.ensureReady();
    // eslint-disable-next-line no-console
    try { if (/^(setoption|position|go|uci|isready)/.test(cmd)) console.info("[WASM->]", cmd); } catch {}
    this.worker!.postMessage(cmd);
  }

  dispose() {
    try { this.worker?.terminate?.(); } catch (_) {}
    this.worker = null;
  }
}

// Track active providers by a logical key so multiple searches can run concurrently
// Key format: `${engineName}::${tab}`; a special "default" key is used when absent
const currentProviders: Map<string, WasmEngineProvider> = new Map();

function makeKey(ctx?: { engineName?: string; tab?: string }): string {
  const name = ctx?.engineName || "default";
  const tab = ctx?.tab || "default";
  return `${name}::${tab}`;
}

export function stopWasmEngine(ctx?: { engineName?: string; tab?: string } | string): void {
  try {
    if (!ctx) {
      // stop all
      for (const [, prov] of Array.from(currentProviders.entries())) {
        try { prov.dispose(); } catch {}
      }
      currentProviders.clear();
      return;
    }
    const key = typeof ctx === "string" ? ctx : makeKey(ctx);
    const prov = currentProviders.get(key);
    try { prov?.dispose(); } catch {}
    currentProviders.delete(key);
  } catch {}
}

// Minimal parser to collect best lines from UCI info messages
function parseBest(line: string) {
  // Extract tokens
  const tokens = line.trim().split(/\s+/);
  const idxPv = tokens.indexOf("pv");
  const idxDepth = tokens.indexOf("depth");
  const idxNodes = tokens.indexOf("nodes");
  const idxScore = tokens.indexOf("score");
  const idxMultipv = tokens.indexOf("multipv");
  if (idxPv < 0) return null;
  const uci_moves = tokens.slice(idxPv + 1);
  const depth = idxDepth >= 0 ? parseInt(tokens[idxDepth + 1] || "0") : 0;
  const nodes = idxNodes >= 0 ? parseInt(tokens[idxNodes + 1] || "0") : 0;
  const multipv = idxMultipv >= 0 ? parseInt(tokens[idxMultipv + 1] || "1") : 1;
  let scoreCp = 0;
  if (idxScore >= 0) {
    const kind = tokens[idxScore + 1];
    const val = parseInt(tokens[idxScore + 2] || "0");
    scoreCp = kind === "cp" ? val : (kind === "mate" ? (val > 0 ? 32000 : -32000) : 0);
  }
  return { depth, nodes, multipv, uci_moves, scoreCp };
}

export async function getBestMovesWasm(
  goMode: GoMode,
  options: EngineOptions,
  ctx?: { engineName?: string; tab?: string },
): Promise<[number, BestMoves[]] | null> {
  const MAX_WEB_DEPTH = 20;
  // eslint-disable-next-line no-console
  // console.info("[WASM] getBestMoves start", { goMode, options });
  // Cancel any in-flight search for this logical key and start fresh
  const key = makeKey(ctx);
  stopWasmEngine(key);
  const engine = new WasmEngineProvider();
  currentProviders.set(key, engine);
  const bestByPv: Map<number, any> = new Map();
  let sentOptions = false;
  let sentGo = false;
  let whiteToMove = true;
  const multiPvTarget = (() => {
    const mpv = (options.extraOptions || []).find((o: any) => o?.name === "MultiPV");
    const parsed = mpv ? Number.parseInt(String((mpv as any).value || "1")) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })();
  let resolved = false;

  return await new Promise((resolve) => {
    const detach = engine.onLine((line) => {
      if (line === "uciok" && !sentOptions) {
        // Apply options after uciok, then wait for readyok before go
        for (const o of options.extraOptions || []) {
          const v = (o as any).value;
          engine.send(`setoption name ${o.name} value ${v}`);
        }
        engine.send("isready");
        sentOptions = true;
      } else if (line === "readyok" && !sentGo) {
        // position
        const moves = options.moves?.length ? ` moves ${options.moves.join(" ")}` : "";
        engine.send(`position fen ${options.fen}${moves}`);
        // go
        const mode = goMode as any;
        // Determine side to move after applying moves to the provided FEN
        try {
          const baseToMove = (options.fen.split(/\s+/)[1] || "w").toLowerCase() === "w";
          const movesCount = options.moves?.length || 0;
          whiteToMove = movesCount % 2 === 0 ? baseToMove : !baseToMove;
        } catch (_) {
          whiteToMove = true;
        }
        if (mode?.t === "Depth") engine.send(`go depth ${Math.min(mode.c ?? MAX_WEB_DEPTH, MAX_WEB_DEPTH)}`);
        else if (mode?.t === "Time") engine.send(`go movetime ${mode.c}`);
        else if (mode?.t === "Nodes") engine.send(`go nodes ${mode.c}`);
        else engine.send(`go depth ${MAX_WEB_DEPTH}`);
        sentGo = true;
      } else if (!resolved && line.startsWith("info ")) {
        const data = parseBest(line);
        if (data) {
          const scoreCpWhite = whiteToMove ? data.scoreCp : -data.scoreCp;
          bestByPv.set(data.multipv, {
            nodes: data.nodes,
            depth: data.depth,
            score: { value: { type: "cp", value: scoreCpWhite } } as any,
            uciMoves: data.uci_moves,
            sanMoves: [],
            multipv: data.multipv,
            nps: 0,
          });
          // Early resolve once we have target MultiPV lines; progress reflects current depth
          if (bestByPv.size >= multiPvTarget) {
            const bestMoves: BestMoves[] = Array.from(bestByPv.values()).sort((a, b) => a.multipv - b.multipv);
            const progress = Math.max(1, Math.min(99, Math.round((data.depth / MAX_WEB_DEPTH) * 100)));
            // Stream partial update to UI without finishing the promise yet
            try {
              emitBestMoves({
                engine: ctx?.engineName || "Stockfish (WASM)",
                tab: ctx?.tab || "default",
                fen: options.fen,
                moves: options.moves || [],
                bestLines: bestMoves,
                progress,
              });
            } catch {}
          }
        }
      } else if (!resolved && line.startsWith("bestmove")) {
        const bestMoves: BestMoves[] = Array.from(bestByPv.values()).sort((a, b) => a.multipv - b.multipv);
        try {
          emitBestMoves({
            engine: ctx?.engineName || "Stockfish (WASM)",
            tab: ctx?.tab || "default",
            fen: options.fen,
            moves: options.moves || [],
            bestLines: bestMoves,
            progress: 100,
          });
        } catch {}
        detach();
        engine.dispose();
        currentProviders.delete(key);
        // eslint-disable-next-line no-console
        // console.info("[WASM] getBestMoves done", { count: bestMoves.length });
        resolve([100, bestMoves]);
      }
    });

    // init UCI session
    engine.send("uci");
  });
}


