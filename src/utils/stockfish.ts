// Built-in Stockfish 19 (lite, single-threaded WebAssembly build by nmrugg/stockfish.js, GPLv3).
// Runs inside a Web Worker, so it works everywhere the webview runs – including iOS,
// where spawning external engine processes is not allowed.

import { makeUci, parseUci } from "chessops";
import { makeSan } from "chessops/san";
import { type BestMoves, type EngineOptions, events, type GoMode, type Score } from "@/bindings";
import type { BestMovesPayload } from "@/bindings/generated";
import { uciNormalize } from "./chess";
import type { RemoteEngine } from "./engines";
import { positionFromFen } from "./chessops";

export const BUILTIN_STOCKFISH_ID = "builtin-stockfish";
export const BUILTIN_STOCKFISH_URL = "builtin://stockfish-19-lite";
const WORKER_URL = "/stockfish/stockfish-19-lite-single.js";

type Search = {
    engineId: string;
    tab: string;
    key: string;
    fen: string;
    moves: string[];
    goMode: GoMode;
    multipv: number;
    start: number;
    lines: BestMoves[];
    lastDepth: number;
    lastEmit: number;
    lastBest: BestMoves[];
    lastProgress: number;
    running: boolean;
};

class StockfishWorker {
    private worker: Worker | null = null;
    private ready: Promise<void> | null = null;
    private search: Search | null = null;
    private pendingReady: (() => void)[] = [];
    // Resolved when the engine reports `bestmove` for the search that is being stopped.
    private stopped: (() => void) | null = null;
    private currentOptions = new Map<string, string>();
    // Requests are processed one at a time; only the newest pending one is kept.
    private queue: Promise<unknown> = Promise.resolve();
    private latestRequest = 0;

    private start(): Promise<void> {
        if (this.ready) return this.ready;
        const worker = new Worker(WORKER_URL);
        this.worker = worker;
        worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
        worker.onerror = (e) => {
            console.error("Stockfish worker crashed, restarting", e);
            this.reset();
        };
        this.ready = new Promise((resolve) => {
            this.pendingReady.push(resolve);
            this.send("uci");
            this.send("isready");
        });
        return this.ready;
    }

    /** Throw the (crashed) worker away; the next request starts a fresh one. */
    private reset() {
        this.worker?.terminate();
        this.worker = null;
        this.ready = null;
        this.search = null;
        this.currentOptions.clear();
        for (const r of this.pendingReady.splice(0)) r();
        this.stopped?.();
        this.stopped = null;
    }

    private send(cmd: string) {
        this.worker?.postMessage(cmd);
    }

    private waitReady(): Promise<void> {
        return withTimeout(
            new Promise<void>((resolve) => {
                this.pendingReady.push(resolve);
                this.send("isready");
            }),
            5000,
        );
    }

    private onLine(line: string) {
        if (line === "readyok") {
            this.pendingReady.shift()?.();
            return;
        }
        if (line.startsWith("bestmove")) {
            const s = this.search;
            if (s?.running) {
                s.running = false;
                s.lastProgress = 100;
                this.emit(s, s.lastBest, 100);
            }
            this.stopped?.();
            this.stopped = null;
            return;
        }
        const s = this.search;
        if (!s || !s.running) return;
        if (line.startsWith("info") && line.includes(" pv ")) {
            this.onInfo(s, line);
        }
    }

    private onInfo(s: Search, line: string) {
        const parsed = parseInfo(line, s.fen, s.moves);
        if (!parsed) return;
        if (parsed.multipv === s.lines.length + 1) {
            s.lines.push(parsed);
            if (parsed.multipv === s.multipv) {
                const depth = parsed.depth;
                const now = Date.now();
                if (
                    s.lines.every((l) => l.depth === depth) &&
                    depth >= s.lastDepth &&
                    now - s.lastEmit >= 200
                ) {
                    const progress = computeProgress(s, parsed);
                    s.lastDepth = depth;
                    s.lastBest = s.lines.slice();
                    s.lastProgress = progress;
                    s.lastEmit = now;
                    this.emit(s, s.lastBest, progress);
                }
                s.lines = [];
            }
        } else if (parsed.multipv === 1) {
            s.lines = [parsed];
        }
    }

    private emit(s: Search, lines: BestMoves[], progress: number) {
        if (lines.length === 0) return;
        void events.bestMovesPayload.emit({
            bestLines: lines as BestMovesPayload["bestLines"],
            engine: s.engineId,
            tab: s.tab,
            fen: s.fen,
            moves: s.moves,
            progress,
        });
    }

    private setOption(name: string, value: string) {
        if (this.currentOptions.get(name) === value) return;
        this.currentOptions.set(name, value);
        this.send(`setoption name ${name} value ${value}`);
    }

    /** Stop the running search and wait until the engine has really finished it. */
    private async stopAndWait() {
        const s = this.search;
        if (!s?.running || !this.worker) return;
        s.running = false;
        const done = new Promise<void>((resolve) => {
            this.stopped = resolve;
        });
        this.send("stop");
        await withTimeout(done, 3000).catch(() => {
            // Engine did not answer: restart it to be safe.
            this.reset();
        });
    }

    stop(): Promise<void> {
        this.latestRequest++;
        return this.enqueue(() => this.stopAndWait());
    }

    private enqueue<T>(job: () => Promise<T>): Promise<T> {
        const run = this.queue.then(job, job);
        this.queue = run.catch(() => undefined);
        return run;
    }

    go(
        engineId: string,
        tab: string,
        goMode: GoMode,
        options: EngineOptions,
    ): Promise<[number, BestMoves[]] | null> {
        const key = JSON.stringify([engineId, tab, goMode, options]);
        const s = this.search;
        if (s && s.key === key && (s.running || s.lastProgress === 100)) {
            return Promise.resolve(s.lastBest.length > 0 ? [s.lastProgress, s.lastBest] : null);
        }
        const request = ++this.latestRequest;
        return this.enqueue(() => this.startSearch(request, key, engineId, tab, goMode, options));
    }

    private async startSearch(
        request: number,
        key: string,
        engineId: string,
        tab: string,
        goMode: GoMode,
        options: EngineOptions,
    ): Promise<[number, BestMoves[]] | null> {
        // A newer request is already waiting: skip this one.
        if (request !== this.latestRequest) return null;
        if (this.search?.key === key && this.search.running) return null;

        const [pos] = positionFromFen(options.fen);
        if (!pos) return null;
        for (const uci of options.moves) {
            const m = parseUci(uci);
            if (!m) return null;
            pos.play(m);
        }

        await this.start();
        await this.stopAndWait();
        if (pos.isEnd()) return null;
        if (!this.worker) await this.start();

        const multipv = Math.max(
            1,
            Number.parseInt(options.extraOptions.find((o) => o.name === "MultiPV")?.value ?? "1") ||
                1,
        );
        const hash = options.extraOptions.find((o) => o.name === "Hash")?.value;
        for (const o of options.extraOptions) {
            // Single-threaded build: Threads is meaningless; MultiPV/Hash handled below.
            if (["Threads", "MultiPV", "Hash"].includes(o.name) || o.value === "") continue;
            this.setOption(o.name, o.value);
        }
        if (hash) this.setOption("Hash", String(Math.min(Number.parseInt(hash) || 16, 256)));
        this.setOption("MultiPV", String(multipv));
        await this.waitReady().catch(() => this.reset());
        if (!this.worker || request !== this.latestRequest) return null;

        this.search = {
            engineId,
            tab,
            key,
            fen: options.fen,
            moves: options.moves,
            goMode,
            multipv,
            start: Date.now(),
            lines: [],
            lastDepth: 0,
            lastEmit: 0,
            lastBest: [],
            lastProgress: 0,
            running: true,
        };

        const movesPart = options.moves.length > 0 ? ` moves ${options.moves.join(" ")}` : "";
        this.send(`position fen ${options.fen}${movesPart}`);
        this.send(goCommand(goMode));
        return null;
    }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("timeout")), ms);
        p.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            },
        );
    });
}

function goCommand(goMode: GoMode): string {
    switch (goMode.t) {
        case "Depth":
            return `go depth ${goMode.c}`;
        case "Time":
            return `go movetime ${goMode.c}`;
        case "Nodes":
            return `go nodes ${goMode.c}`;
        default:
            return "go infinite";
    }
}

function computeProgress(s: Search, b: BestMoves): number {
    const g = s.goMode;
    switch (g.t) {
        case "Depth":
            return Math.min(99.99, (b.depth / g.c) * 100);
        case "Time":
            return Math.min(99.99, ((Date.now() - s.start) / g.c) * 100);
        case "Nodes":
            return Math.min(99.99, (b.nodes / g.c) * 100);
        default:
            return 99.99;
    }
}

function parseInfo(line: string, fen: string, moves: string[]): BestMoves | null {
    const t = line.split(" ");
    let depth = 0;
    let multipv = 1;
    let nodes = 0;
    let nps = 0;
    let score: Score | null = null;
    let pv: string[] = [];
    for (let i = 1; i < t.length; i++) {
        switch (t[i]) {
            case "depth":
                depth = Number(t[++i]);
                break;
            case "multipv":
                multipv = Number(t[++i]);
                break;
            case "nodes":
                nodes = Number(t[++i]);
                break;
            case "nps":
                nps = Number(t[++i]);
                break;
            case "score": {
                const kind = t[++i];
                const value = Number(t[++i]);
                if (t[i + 1] === "lowerbound" || t[i + 1] === "upperbound") return null;
                score = {
                    value: kind === "mate" ? { type: "mate", value } : { type: "cp", value },
                    wdl: null,
                };
                break;
            }
            case "pv":
                pv = t.slice(i + 1);
                i = t.length;
                break;
        }
    }
    if (!score || pv.length === 0) return null;

    const [pos] = positionFromFen(fen);
    if (!pos) return null;
    for (const uci of moves) {
        const m = parseUci(uci);
        if (!m) return null;
        pos.play(m);
    }
    const blackToMove = pos.turn === "black";
    const sanMoves: string[] = [];
    const uciMoves: string[] = [];
    for (const uci of pv) {
        const m = parseUci(uci);
        if (!m || !pos.isLegal(m)) break;
        sanMoves.push(makeSan(pos, m));
        uciMoves.push(uciNormalize(pos, m));
        pos.play(m);
    }
    if (sanMoves.length === 0) return null;

    // Scores are reported from White's point of view throughout the app.
    if (blackToMove) {
        score = {
            value: { type: score.value.type, value: -score.value.value } as Score["value"],
            wdl: null,
        };
    }
    return { depth, multipv, nodes, nps, score, sanMoves, uciMoves };
}

// One engine instance is shared; only the active tab analyses at a time.
const instance = new StockfishWorker();

export function stockfishGetBestMoves(engineId: string) {
    return (tab: string, goMode: GoMode, options: EngineOptions) =>
        instance.go(engineId, tab, goMode, options);
}

export function stockfishStop() {
    return instance.stop();
}

/** Engine entry for the built-in Stockfish, as stored in the engines list. */
export function builtinStockfish(): RemoteEngine {
    return {
        id: BUILTIN_STOCKFISH_ID,
        name: "Stockfish 19",
        type: "stockfish",
        url: BUILTIN_STOCKFISH_URL,
        loaded: true,
        enabled: true,
        go: { t: "Depth", c: 22 },
        settings: [
            { name: "MultiPV", value: "3" },
            { name: "Hash", value: "32" },
        ],
    };
}

// ---------------------------------------------------------------------------
// Playing against the built-in Stockfish (its own worker, separate from analysis).

/** Stockfish's own calibrated `UCI_Elo` range. */
export const STOCKFISH_NATIVE_MIN_ELO = 1320;
export const STOCKFISH_MAX_ELO = 3190;
/** Below the native range the engine is weakened by us (approximate strength). */
export const STOCKFISH_MIN_ELO = 100;

const WEAK_MULTIPV = 10;

/**
 * How the engine is weakened below Elo 1320:
 * shallow search, a soft choice among the top candidate moves (bigger "temperature"
 * = more willing to pick worse moves) and an occasional completely random move.
 */
function weakParams(elo: number) {
    const t = Math.min(1, Math.max(0, (elo - STOCKFISH_MIN_ELO) / (STOCKFISH_NATIVE_MIN_ELO - STOCKFISH_MIN_ELO)));
    return {
        depth: 1 + Math.round(5 * t),
        randomChance: 0.55 * (1 - t) ** 1.6,
        temperature: 35 + 400 * (1 - t) ** 1.3, // centipawns
    };
}

function scoreToCp(kind: string, value: number) {
    if (kind === "mate") return value > 0 ? 100000 - value : -100000 - value;
    return value;
}

export type PlayMoveRequest = {
    fen: string;
    moves: string[];
    /** null = full strength */
    elo: number | null;
    /** Used when the game has no clock. */
    go: GoMode;
    /** Remaining clock times in ms (null when the game has no clock). */
    clock: { wtime: number; btime: number; winc: number; binc: number } | null;
};

class StockfishPlayer {
    private worker: Worker | null = null;
    private ready: Promise<void> | null = null;
    private pendingReady: (() => void)[] = [];
    private onBest: ((uci: string | null) => void) | null = null;
    /** Candidate moves of the current search (weak mode): multipv -> [move, cp] */
    private candidates = new Map<number, [string, number]>();
    private queue: Promise<unknown> = Promise.resolve();
    private options = new Map<string, string>();

    private start(): Promise<void> {
        if (this.ready) return this.ready;
        const worker = new Worker(WORKER_URL);
        this.worker = worker;
        worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
        worker.onerror = (e) => {
            console.error("Stockfish (play) worker crashed, restarting", e);
            this.reset();
        };
        this.ready = new Promise((resolve) => {
            this.pendingReady.push(resolve);
            this.send("uci");
            this.send("isready");
        });
        return this.ready;
    }

    private reset() {
        this.worker?.terminate();
        this.worker = null;
        this.ready = null;
        this.options.clear();
        for (const r of this.pendingReady.splice(0)) r();
        this.onBest?.(null);
        this.onBest = null;
    }

    private send(cmd: string) {
        this.worker?.postMessage(cmd);
    }

    private onLine(line: string) {
        if (line === "readyok") {
            this.pendingReady.shift()?.();
        } else if (line.startsWith("bestmove")) {
            const uci = line.split(" ")[1];
            const cb = this.onBest;
            this.onBest = null;
            cb?.(uci && uci !== "(none)" ? uci : null);
        } else if (line.startsWith("info") && line.includes(" pv ")) {
            const t = line.split(" ");
            let multipv = 1;
            let kind = "";
            let value = 0;
            let move = "";
            let bound = false;
            for (let i = 1; i < t.length; i++) {
                if (t[i] === "multipv") multipv = Number(t[++i]);
                else if (t[i] === "score") {
                    kind = t[++i];
                    value = Number(t[++i]);
                    if (t[i + 1] === "lowerbound" || t[i + 1] === "upperbound") bound = true;
                } else if (t[i] === "pv") {
                    move = t[i + 1] ?? "";
                    break;
                }
            }
            if (move && kind && !bound) this.candidates.set(multipv, [move, scoreToCp(kind, value)]);
        }
    }

    private setOption(name: string, value: string) {
        if (this.options.get(name) === value) return;
        this.options.set(name, value);
        this.send(`setoption name ${name} value ${value}`);
    }

    private enqueue<T>(job: () => Promise<T>): Promise<T> {
        const run = this.queue.then(job, job);
        this.queue = run.catch(() => undefined);
        return run;
    }

    /** Abort a running search; its result is discarded. */
    stop() {
        if (this.onBest) this.send("stop");
    }

    newGame() {
        return this.enqueue(async () => {
            await this.start();
            this.send("ucinewgame");
        });
    }

    bestMove(req: PlayMoveRequest): Promise<string | null> {
        this.stop();
        return this.enqueue(async () => {
            await this.start();
            const elo =
                req.elo === null
                    ? null
                    : Math.round(Math.min(STOCKFISH_MAX_ELO, Math.max(STOCKFISH_MIN_ELO, req.elo)));
            const weak = elo !== null && elo < STOCKFISH_NATIVE_MIN_ELO ? weakParams(elo) : null;
            if (elo === null || weak) {
                this.setOption("UCI_LimitStrength", "false");
            } else {
                this.setOption("UCI_LimitStrength", "true");
                this.setOption("UCI_Elo", String(elo));
            }
            this.setOption("MultiPV", weak ? String(WEAK_MULTIPV) : "1");
            this.setOption("Hash", "32");
            await withTimeout(
                new Promise<void>((resolve) => {
                    this.pendingReady.push(resolve);
                    this.send("isready");
                }),
                5000,
            ).catch(() => this.reset());
            if (!this.worker) await this.start();

            this.candidates.clear();
            const best = new Promise<string | null>((resolve) => {
                this.onBest = resolve;
            });
            if (weak) {
                const started = Date.now();
                const movesPart = req.moves.length > 0 ? ` moves ${req.moves.join(" ")}` : "";
                this.send(`position fen ${req.fen}${movesPart}`);
                this.send(`go depth ${weak.depth}`);
                const engineMove = await best;
                const chosen = pickWeakMove(req, weak, this.candidates) ?? engineMove;
                // Don't answer instantly: a short "thinking" pause feels more natural.
                const wait = 500 + Math.random() * 700 - (Date.now() - started);
                if (wait > 0) await new Promise((r) => setTimeout(r, wait));
                return chosen;
            }
            const movesPart = req.moves.length > 0 ? ` moves ${req.moves.join(" ")}` : "";
            this.send(`position fen ${req.fen}${movesPart}`);
            if (req.clock) {
                const c = req.clock;
                this.send(
                    `go wtime ${Math.max(0, Math.round(c.wtime))} btime ${Math.max(0, Math.round(c.btime))} winc ${c.winc} binc ${c.binc}`,
                );
            } else if (req.go.t === "Infinite" || req.go.t === "PlayersTime") {
                this.send("go movetime 1500");
            } else {
                this.send(goCommand(req.go));
            }
            return best;
        });
    }
}

function pickWeakMove(
    req: PlayMoveRequest,
    weak: ReturnType<typeof weakParams>,
    candidates: Map<number, [string, number]>,
): string | null {
    const [pos] = positionFromFen(req.fen);
    if (!pos) return null;
    for (const uci of req.moves) {
        const m = parseUci(uci);
        if (!m) return null;
        pos.play(m);
    }
    // Occasionally a completely random legal move (beginners overlook a lot).
    if (Math.random() < weak.randomChance) {
        const legal: string[] = [];
        for (const [from, dests] of pos.allDests()) {
            for (const to of dests) {
                const promo = pos.board.get(from)?.role === "pawn" && (to >> 3 === 7 || to >> 3 === 0);
                legal.push(makeUci({ from, to, promotion: promo ? "queen" : undefined }));
            }
        }
        if (legal.length > 0) return legal[Math.floor(Math.random() * legal.length)];
    }
    // Otherwise a softmax choice among the engine's candidate moves.
    const list = [...candidates.values()];
    if (list.length === 0) return null;
    const bestCp = Math.max(...list.map(([, cp]) => cp));
    const weights = list.map(([, cp]) => Math.exp((cp - bestCp) / weak.temperature));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i][0];
    }
    return list[0][0];
}

const player = new StockfishPlayer();

export function stockfishPlayMove(req: PlayMoveRequest) {
    return player.bestMove(req);
}

export function stockfishPlayStop() {
    player.stop();
}

export function stockfishPlayNewGame() {
    return player.newGame();
}

/** Player name in the game/PGN; the strength goes into the Elo header. */
export function builtinPlayerName(_elo: number | null) {
    return "Stockfish 19";
}
