import type { BestMoves, EngineOption, EngineOptions, GoMode, Score } from "@/bindings";
import { getBestMovesWasm, stopWasmEngine } from "@/engine/providers/wasm";
import { listenBestMoves } from "@/utils/webEvents";

export type MoveScore = { uci: string; score: Score };

export async function getBestMoves(
  engineName: string,
  tab: string,
  goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  try {
    // eslint-disable-next-line no-console
    console.info("[WEB] getBestMoves", { goMode, options });
    // Fire the analysis and stream intermediate updates via webEvents
    const res = await getBestMovesWasm(goMode, options, { engineName, tab });
    // eslint-disable-next-line no-console
    console.info("[WEB] getBestMoves result", { present: !!res, count: res?.[1]?.length });
    return res;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[WEB] getBestMoves error", e);
    return null;
  }
}

export async function scoreAllMoves(
  _engineName: string,
  goMode: GoMode,
  options: EngineOptions,
): Promise<MoveScore[]> {
  // eslint-disable-next-line no-console
  console.info("[WEB] scoreAllMoves", { goMode, options });
  const res = await getBestMovesWasm(goMode, options);
  if (!res) return [];
  const [, best] = res;
  return best
    .map((b) => ({ uci: b.uci_moves[0], score: b.score }))
    .filter((x) => Boolean(x.uci));
}

export async function stopEngine(engineName: string, tab: string): Promise<void> {
  try { stopWasmEngine({ engineName, tab }); } catch {}
}
export async function killEngine(): Promise<void> { /* no-op in web */ }


