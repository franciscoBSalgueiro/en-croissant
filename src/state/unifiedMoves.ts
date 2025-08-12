import { currentDbTypeAtom, currentLocalOptionsAtom, enginesAtom, engineMovesFamily, lichessOptionsAtom, masterOptionsAtom, referenceDbAtom } from "@/state/atoms";
import type { Annotation } from "@/utils/annotation";
import { getAnnotation, getWinChance, normalizeScore } from "@/utils/score";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { match } from "ts-pattern";
import type { BestMoves, ScoreValue } from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { type Opening, searchPosition } from "@/utils/db";
import { convertToNormalized, getLichessGames, getMasterGames } from "@/utils/lichess/api";
import type { LichessGamesOptions, MasterGamesOptions } from "@/utils/lichess/explorer";

// Database types
export type DBType =
  | { type: "local"; options: LocalOptions }
  | { type: "lch_all"; options: LichessGamesOptions; fen: string }
  | { type: "lch_master"; options: MasterGamesOptions; fen: string };

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white),
  );
}

async function fetchOpening(db: DBType, tab: string) {
  return match(db)
    .with({ type: "lch_all" }, async ({ fen, options }) => {
      const data = await getLichessGames(fen, options);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(
          data.topGames || data.recentGames || [],
        ),
      } as { openings: Opening[]; games: any[] };
    })
    .with({ type: "lch_master" }, async ({ fen, options }) => {
      const data = await getMasterGames(fen, options);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(
          data.topGames || data.recentGames || [],
        ),
      } as { openings: Opening[]; games: any[] };
    })
    .with({ type: "local" }, async ({ options }) => {
      if (!options.path) throw Error("Missing reference database");
      const positionData = await searchPosition(options, tab);
      return {
        openings: sortOpenings(positionData[0]),
        games: positionData[1],
      } as { openings: Opening[]; games: any[] };
    })
    .exhaustive();
}

// Unified move data combining database stats and engine analysis
export interface UnifiedMove {
  move: string;
  san: string;
  // Database stats
  white?: number;
  black?: number;
  draw?: number;
  total?: number;
  percentage?: number;
  whitePercentage?: number;
  drawPercentage?: number;
  blackPercentage?: number;
  // Engine analysis
  score?: any;
  winChance?: number;
  winDelta?: number;
  depth?: number;
  nodes?: number;
  engineName?: string;
  pv?: string[];
  sanMoves?: string[];
  // Annotation
  annotation?: Annotation;
  // Extra flags
  isSacrifice?: boolean;
  isOnlyMove?: boolean;
  punishesMistake?: boolean;
  // Mark best move in current ordering
  isBest?: boolean;
  // Combined ranking
  rank: number;
  source: "database" | "engine" | "both";
}

export const unifiedMovesFamily = atomFamily(
  ({ rootFen, fen, moves, tab }: { rootFen: string; fen: string; moves: string[]; tab: string }) =>
    atom<Promise<UnifiedMove[]>>(async (get) => {
      const db = get(currentDbTypeAtom);
      const referenceDatabase = get(referenceDbAtom);
      const lichessOptions = get(lichessOptionsAtom);
      const masterOptions = get(masterOptionsAtom);
      const localOpts = get(currentLocalOptionsAtom);

      // Prepare LocalOptions overridden with current fen and path
      const effectiveLocalOptions: LocalOptions = {
        ...localOpts,
        fen,
        path: localOpts.path ?? referenceDatabase,
      };

      const dbType: DBType = match(db)
        .with("local", (v) => ({ type: v, options: effectiveLocalOptions }))
        .with("lch_all", (v) => ({ type: v, options: lichessOptions, fen }))
        .with("lch_master", (v) => ({ type: v, options: masterOptions, fen }))
        .exhaustive();

      const { openings } = await fetchOpening(dbType, tab);

      const engines = get(enginesAtom).filter((e) => e.loaded);

      // Collect engine moves for this position
      const allEngineMoves = new Map<string, BestMoves[]>();
      const key = `${rootFen}:${moves.join(",")}`;
      for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];
        const map = get(engineMovesFamily({ engine: engine.name, tab }));
        const movesData = map.get(key);
        if (movesData && movesData.length > 0) {
          allEngineMoves.set(engine.name, movesData);
        }
      }

      const [pos] = positionFromFen(fen);
      const currentTurn = pos?.turn || "white";

      // Process engine data and database data into unified moves
      const moveMap = new Map<string, UnifiedMove>();
      let rank = 1;

      // Add database moves
      if (openings) {
        const grandTotal = openings.reduce(
          (acc, curr) => acc + curr.black + curr.white + curr.draw,
          0,
        );
        for (const opening of openings) {
          // Skip summary rows if any
          if ((opening as any).move === "Total") continue;
          const total = opening.white + opening.black + opening.draw;
          const percentage = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          const whitePercentage = total > 0 ? (opening.white / total) * 100 : 0;
          const drawPercentage = total > 0 ? (opening.draw / total) * 100 : 0;
          const blackPercentage = total > 0 ? (opening.black / total) * 100 : 0;
          const moveSan = (opening as any).move as string;
          moveMap.set(moveSan, {
            move: moveSan,
            san: moveSan,
            white: opening.white,
            black: opening.black,
            draw: opening.draw,
            total,
            percentage,
            whitePercentage,
            drawPercentage,
            blackPercentage,
            rank: rank++,
            source: "database",
          });
        }
      }

      // Determine primary engine multipv list for annotation decisions (only-move etc.)
      let primaryEngineMoves: BestMoves[] | undefined;
      let primaryEngineName: string | undefined;
      if (allEngineMoves.size > 0) {
        const preferredName = engines[0]?.name;
        if (preferredName && allEngineMoves.has(preferredName)) {
          primaryEngineMoves = allEngineMoves.get(preferredName) as any;
          primaryEngineName = preferredName;
        } else {
          const firstEntry = Array.from(allEngineMoves.entries())[0];
          primaryEngineName = firstEntry?.[0];
          primaryEngineMoves = firstEntry?.[1] as any;
        }
      }

      // Compute prev evaluation score for current position using primary engine (top line)
      const prevScoreValue: ScoreValue | undefined = primaryEngineMoves && primaryEngineMoves.length > 0
        ? primaryEngineMoves[0].score.value
        : undefined;

      // Compute prevprev evaluation (position before opponent's last move) from the primary engine, if available
      let prevprevScoreValue: ScoreValue | undefined = undefined;
      if (primaryEngineName && moves.length > 0) {
        const prevKey = `${rootFen}:${moves.slice(0, -1).join(",")}`;
        const primaryIndex = engines.findIndex((e) => e.name === primaryEngineName);
        if (primaryIndex >= 0) {
          const engineMap = get(engineMovesFamily({ engine: engines[primaryIndex].name, tab }));
          const prevBestMoves = engineMap.get(prevKey);
          if (prevBestMoves && prevBestMoves.length > 0) {
            prevprevScoreValue = prevBestMoves[0].score.value;
          }
        }
      }

      // Baseline Win Likelihood for current position (before making any move)
      let baseWinChance: number | undefined = undefined;
      if (primaryEngineMoves && primaryEngineMoves.length > 0 && pos) {
        const baseScore = primaryEngineMoves[0].score;
        const wdl = baseScore?.wdl as [number, number, number] | null | undefined;
        if (wdl) {
          const [w, d, l] = wdl;
          const total = w + d + l;
          if (total > 0) {
            baseWinChance = (pos.turn === "white" ? (w / total) : (l / total)) * 100;
          }
        }
        if (baseWinChance === undefined && prevScoreValue) {
          baseWinChance = getWinChance(normalizeScore(prevScoreValue, pos.turn));
        }
      }

      // Compute "only move" and "punishes mistake" flags for the top line
      let topMoveSan: string | undefined;
      let isOnlyMoveTop = false;
      let punishesMistakeTop = false;
      if (primaryEngineMoves && primaryEngineMoves.length > 0 && pos) {
        topMoveSan = primaryEngineMoves[0]?.sanMoves?.[0];
        if (primaryEngineMoves.length > 1) {
          const a = primaryEngineMoves[0].score.value;
          const b = primaryEngineMoves[1].score.value;
          const aCP = normalizeScore(a, pos.turn);
          const bCP = normalizeScore(b, pos.turn);
          const gap = getWinChance(aCP) - getWinChance(bCP);
          isOnlyMoveTop = gap > 10;
        }
        if (prevprevScoreValue) {
          const aCP = normalizeScore(primaryEngineMoves[0].score.value, pos.turn);
          const prevPrevCP = normalizeScore(prevprevScoreValue, pos.turn);
          punishesMistakeTop = getWinChance(aCP) - getWinChance(prevPrevCP) > 5;
        }
      }

      // Add engine moves from actual engine data
      if (allEngineMoves.size > 0 && pos) {
        const allEngineLines: Array<{
          move: string;
          san: string;
          score: any;
          winChance: number;
          engineName: string;
          sanMoves: string[];
          depth: number;
          nodes: number;
        }> = [];

        for (const [engineName, movesData] of allEngineMoves.entries()) {
          for (const moveData of movesData) {
            if (moveData.sanMoves && moveData.sanMoves.length > 0) {
              const firstMove = moveData.sanMoves[0];
              let winChance = 50;
              if (moveData.score) {
                const wdl = moveData.score.wdl as [number, number, number] | null | undefined;
                if (wdl) {
                  const [w, d, l] = wdl;
                  const total = w + d + l;
                  if (total > 0) {
                    winChance = (pos.turn === "white" ? (w / total) : (l / total)) * 100;
                  }
                } else {
                  winChance = getWinChance(
                    normalizeScore(moveData.score.value, pos.turn)
                  );
                }
              }

              allEngineLines.push({
                move: firstMove,
                san: firstMove,
                score: moveData.score,
                winChance,
                engineName,
                sanMoves: moveData.sanMoves || [],
                depth: moveData.depth || 0,
                nodes: moveData.nodes || 0,
              });
            }
          }
        }

        // Group by move and take best analysis
        const engineMoveMap = new Map<string, any>();
        for (const line of allEngineLines) {
          const existing = engineMoveMap.get(line.move);
          if (!existing || line.winChance > existing.winChance) {
            engineMoveMap.set(line.move, line);
          }
        }

        // Add engine moves to unified data
        for (const [move, data] of engineMoveMap.entries()) {
          const existing = moveMap.get(move);
          // Compute annotation if possible
          let annotation: Annotation | undefined = undefined;
          if (prevScoreValue && data.score) {
            const prevCP = normalizeScore(prevScoreValue, currentTurn);
            const nextCP = normalizeScore(data.score.value, currentTurn);
            const isSacrifice = nextCP < prevCP;
            annotation = getAnnotation(
              prevprevScoreValue ?? null,
              prevScoreValue,
              data.score.value,
              currentTurn,
              (primaryEngineMoves || []) as BestMoves[],
              isSacrifice,
              move,
            );
          }
          const winDelta = baseWinChance !== undefined && data.winChance !== undefined
            ? data.winChance - baseWinChance
            : undefined;
          const isSacrificeFlag = (() => {
            if (!pos || !data.sanMoves || data.sanMoves.length === 0) return false;
            if (baseWinChance === undefined || data.winChance === undefined) return false;
            if (data.winChance <= baseWinChance) return false;

            const [startPos] = positionFromFen(fen);
            if (!startPos) return false;
            const first = parseSan(startPos, data.sanMoves[0]);
            if (!first || !("from" in (first as any)) || !("to" in (first as any))) return false;
            let pieceSquare: any = (first as any).to;
            const movedFrom: any = (first as any).from;
            const movedPieceBefore = startPos.board.get(movedFrom);
            if (!movedPieceBefore) return false;
            startPos.play(first as any);

            const maxPlies = Math.min(5, data.sanMoves.length - 1);
            for (let i = 1; i <= maxPlies; i++) {
              const san = data.sanMoves[i];
              const moveObj = parseSan(startPos, san);
              if (!moveObj) break;
              const sideToMove = startPos.turn;
              if (pieceSquare !== undefined && sideToMove !== movedPieceBefore.color) {
                const toSq: any = (moveObj as any).to;
                if (toSq !== undefined && toSq === pieceSquare) {
                  return true;
                }
              }
              if (pieceSquare !== undefined && sideToMove === movedPieceBefore.color) {
                const fromSq: any = (moveObj as any).from;
                const toSq: any = (moveObj as any).to;
                if (fromSq !== undefined && toSq !== undefined && fromSq === pieceSquare) {
                  pieceSquare = toSq;
                }
              }
              startPos.play(moveObj as any);
            }
            return false;
          })();
          const isOnlyMoveFlag = move === topMoveSan ? isOnlyMoveTop : false;
          const punishesFlag = move === topMoveSan ? punishesMistakeTop : false;

          if (existing) {
            existing.score = data.score;
            existing.winChance = data.winChance;
            existing.winDelta = winDelta;
            existing.engineName = data.engineName;
            existing.sanMoves = data.sanMoves;
            existing.depth = data.depth;
            existing.nodes = data.nodes;
            existing.source = "both";
            existing.annotation = annotation;
            existing.isSacrifice = isSacrificeFlag;
            existing.isOnlyMove = isOnlyMoveFlag;
            existing.punishesMistake = punishesFlag;
          } else {
            moveMap.set(move, {
              move,
              san: move,
              score: data.score,
              winChance: data.winChance,
              winDelta,
              engineName: data.engineName,
              sanMoves: data.sanMoves,
              depth: data.depth,
              nodes: data.nodes,
              annotation,
              isSacrifice: isSacrificeFlag,
              isOnlyMove: isOnlyMoveFlag,
              punishesMistake: punishesFlag,
              rank: rank++,
              source: "engine",
            });
          }
        }
      }

      // Sort by engine analysis first, then by database frequency
      const sorted = Array.from(moveMap.values()).sort((a, b) => {
        if (a.winChance !== undefined && b.winChance !== undefined) {
          return b.winChance - a.winChance;
        }
        if (a.winChance !== undefined) return -1;
        if (b.winChance !== undefined) return 1;
        if (a.total && b.total) {
          return b.total - a.total;
        }
        if (a.total && !b.total) return -1;
        if (!a.total && b.total) return 1;
        return 0;
      });

      const bestIdx = sorted.findIndex((m) => m.winChance !== undefined || m.score);
      if (bestIdx >= 0) {
        sorted[bestIdx] = { ...sorted[bestIdx], isBest: true };
      }
      return sorted;
    }),
  (a, b) => a.rootFen === b.rootFen && a.fen === b.fen && a.tab === b.tab && a.moves.length === b.moves.length && a.moves.every((m, i) => m === b.moves[i]),
); 