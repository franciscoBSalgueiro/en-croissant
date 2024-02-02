import { BestMoves, EngineOptions, GoMode } from "@/bindings";
import { fetch } from "@tauri-apps/api/http";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { positionFromFen } from "./chessops";

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
        parseInt(
          options.extraOptions.find((o) => o.name === "MultiPV")?.value ?? "1",
        ),
      )
      .map((m, i) => ({
        score: { type: "cp", value: m.score },
        nodes: 0,
        depth: m.depth ?? 0,
        multipv: i + 1,
        nps: 0,
        sanMoves: m.san,
        uciMoves: m.uci,
      })),
  ];
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
  const res = await fetch<AllResponse>(url.toString());

  if (res.data.status !== "ok") {
    return [];
  }

  const data: CachedResult[] = res.data.moves.map((m) => ({
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
  const res = await fetch<BestResponse>(url.toString());

  if (res.data.status !== "ok") {
    return null;
  }

  const data = res.data;
  const side = fen.split(" ")[1];
  if (side === "b") {
    data.score *= -1;
  }

  return data;
}
