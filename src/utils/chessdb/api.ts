import type { BestMoves, EngineOptions, GoMode, ScoreValue } from "@/bindings";
import { fetch } from "@tauri-apps/plugin-http";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { positionFromFen } from "../chessops";

const endpoint = "https://www.chessdb.cn/cdb.php";

type AllResponse = {
  status: string;
  moves: ChessDBData[];
};

type BestResponse = {
  status: string;
  depth: number;
  score: number;
  pv: string[];
  pvSAN: string[];
};

type ChessDBData = {
  uci: string;
  san: string;
  score: number;
  rank: number;
  note: string;
  winrate?: string;
};

export async function getBestMoves(
  _tab: string,
  _goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  const [pos] = positionFromFen(options.fen);
  if (!pos) {
    return null;
  }
  for (const uci of options.moves) {
    const m = parseUci(uci);
    if (!m) {
      return null;
    }
    pos.play(m);
  }
  const moves = await queryPosition(makeFen(pos.toSetup()));
  return [
    100,
    moves
      .slice(
        0,
        Number.parseInt(
          options.extraOptions.find((o) => o.name === "MultiPV")?.value ?? "1",
        ),
      )
      .map((m, i) => ({
        score: { value: chessDBevalToScore(m.score), wdl: null },
        nodes: 0,
        depth: m.depth ?? 0,
        multipv: i + 1,
        nps: 0,
        sanMoves: m.san,
        uciMoves: m.uci,
      })),
  ];
}

function chessDBevalToScore(score: number): ScoreValue {
  if (Math.abs(score) > 250_00) {
    return {
      type: "mate",
      value:
        Math.floor((300_00 - Math.abs(score) + 1) / 2) * (score > 0 ? 1 : -1),
    };
  }
  if (Math.abs(score) > 200_00) {
    return {
      type: "dtz",
      value: (250_00 - Math.abs(score)) * (score > 0 ? 1 : -1),
    };
  }
  if (Math.abs(score) > 150_00) {
    return {
      type: "dtz",
      value: (200_00 - Math.abs(score)) * (score > 0 ? 1 : -1),
    };
  }

  return { type: "cp", value: score };
}

type CachedResult = {
  uci: string[];
  san: string[];
  score: number;
  rank: number;
  note: string;
  depth?: number;
  winrate?: string;
};

const cache = new Map<string, CachedResult[]>();

async function queryPosition(fen: string) {
  if (cache.has(fen)) {
    return cache.get(fen)!;
  }
  const side = fen.split(" ")[1];

  const url = new URL(endpoint);
  url.searchParams.append("action", "queryall");
  url.searchParams.append("json", "1");
  url.searchParams.append("board", fen);
  const res = (await (await fetch(url.toString())).json()) as AllResponse;

  if (res.status !== "ok") {
    return [];
  }

  const data: CachedResult[] = res.moves.map((m) => ({
    ...m,
    score: side === "b" ? -m.score : m.score,
    uci: [m.uci],
    san: [m.san],
  }));

  const best = await queryBest(fen);
  if (best) {
    data[0].depth = best.depth;
    data[0].uci = best.pv;
    data[0].san = best.pvSAN;
  }

  cache.set(fen, data);
  return data;
}

async function queryBest(fen: string) {
  const url = new URL(endpoint);
  url.searchParams.append("action", "querypv");
  url.searchParams.append("json", "1");
  url.searchParams.append("board", fen);
  const res = (await (await fetch(url.toString())).json()) as BestResponse;

  if (res.status !== "ok") {
    return null;
  }

  const side = fen.split(" ")[1];
  if (side === "b") {
    res.score *= -1;
  }

  return res;
}
