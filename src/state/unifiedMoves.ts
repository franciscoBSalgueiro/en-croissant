import { currentDbTypeAtom, currentLocalOptionsAtom, enginesAtom, engineMovesFamily, lichessOptionsAtom, masterOptionsAtom, referenceDbAtom } from "@/state/atoms";
import type { Annotation } from "@/utils/annotation";
import { getAnnotation, getWinChance, normalizeScore } from "@/utils/score";
import { positionFromFen } from "@/utils/chessops";
import { parseUci, squareFile, squareRank, type Role } from "chessops";
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
import { activeTabAtom, tabEngineSettingsFamily } from "@/state/atoms";
import { swapMove } from "@/utils/chessops";
import { INITIAL_FEN } from "chessops/fen";
import { getMaterialDiff } from "@/utils/chess";

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
  // Optional: full move number in game when this move was played
  moveNumber?: number;
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
  // Per-move metadata for SAN in PV line (from current position)
  sanMeta?: {
    san: string;
    pieceLetter: string; // p, n, b, r, q, k
    pieceColor: "white" | "black";
    fromSquare?: string; // e.g. e2
    toSquare?: string; // e.g. e4
    fromSquareColor?: "light" | "dark";
    toSquareColor?: "light" | "dark";
    iconFilename?: string; // piece icon for the moving piece on its from square
    isCapture?: boolean;
    promotion?: "q" | "r" | "b" | "n";
  }[];
  // Material delta after playing the entire PV line from this position (white minus black)
  materialDelta?: number;
  // Material gained/lost by the side-to-move after playing the entire PV
  // Encoded as repeated letters: "pp" for 2 pawns, "pq" for pawn+queen
  materialGained?: string;
  materialLost?: string;
  // Piece metadata for first move of line
  pieceLetter?: string; // e.g. p, n, b, r, q, k
  pieceColor?: "white" | "black";
  pieceSquareColor?: "light" | "dark";
  // Icon filename for rendering the piece on its starting square
  iconFilename?: string; // e.g. "Chess_qll45.svg"
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
  // Synthetic: overall confidence (0..100)
  confidence?: number;
  // New: percentage relative to the best confidence (0..100)
  pctBest?: number;
  // Whether this entry was derived from threat search context
  isThreat?: boolean;
}

export const unifiedMovesFamily = atomFamily(
  ({ rootFen, fen, moves, tab }: { rootFen: string; fen: string; moves: string[]; tab: string }) =>
    atom<Promise<UnifiedMove[]>>(async (get) => {
      // Simple in-memory cache for openings per (dbType, fen) to reduce churn on rapid updates
      const openingsCache = (globalThis as any).__openingsCache || ((globalThis as any).__openingsCache = new Map<string, any>());
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

      // Fetch openings non-blockingly; if it fails, continue with engines only
      let openings: Opening[] = [] as any;
      const cacheKey = `${(dbType as any).type}:${fen}:${tab}`;
      try {
        if (openingsCache.has(cacheKey)) {
          openings = openingsCache.get(cacheKey) as Opening[];
        } else {
          const res = await fetchOpening(dbType, tab);
          openings = res.openings || [] as any;
          openingsCache.set(cacheKey, openings);
        }
      } catch {
        openings = [] as any;
      }

      const engines = get(enginesAtom).filter((e) => e.loaded);

      // Collect engine moves for this position
      const allEngineMoves = new Map<string, BestMoves[]>();
      // Support threat context by preferring threat key when present
      const [posForFinal] = positionFromFen(fen);
      const finalFen = posForFinal ? makeFen(posForFinal.toSetup()) : INITIAL_FEN;
      const normalKey = `${rootFen}:${moves.join(",")}`;
      const threatKey = `${swapMove(finalFen)}:`;
      let usedThreat = false;
      for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];
        const map = get(engineMovesFamily({ engine: engine.name, tab }));
        const threatData = map.get(threatKey);
        const normalData = map.get(normalKey);
        const movesData = threatData || normalData;
        if (movesData && movesData.length > 0) {
          allEngineMoves.set(engine.name, movesData);
          if (threatData) usedThreat = true;
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
            isThreat: false,
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
          pv: string[];
          depth: number;
          nodes: number;
          isThreat: boolean;
          pieceLetter: string;
          pieceColor: "white" | "black";
          pieceSquareColor: "light" | "dark";
          iconFilename?: string;
          sanMeta?: {
            san: string;
            pieceLetter: string;
            pieceColor: "white" | "black";
            fromSquare?: string;
            toSquare?: string;
            fromSquareColor?: "light" | "dark";
            toSquareColor?: "light" | "dark";
            iconFilename?: string;
            isCapture?: boolean;
            promotion?: "q" | "r" | "b" | "n";
          }[];
          materialDelta?: number;
          materialGained?: string;
          materialLost?: string;
        }> = [];

        for (const [engineName, movesData] of allEngineMoves.entries()) {
          for (const moveData of movesData) {
            if ((moveData.sanMoves && moveData.sanMoves.length > 0) || (moveData.uciMoves && moveData.uciMoves.length > 0)) {
              // Build SAN list from current position if needed
              let sanList: string[] = [];
              if (moveData.sanMoves && moveData.sanMoves.length > 0) {
                sanList = [...moveData.sanMoves];
              } else if (Array.isArray(moveData.uciMoves) && moveData.uciMoves.length > 0) {
                const posForSan = pos.clone();
                const converted: string[] = [];
                for (const uci of moveData.uciMoves) {
                  const mv = parseUci(uci);
                  if (!mv) break;
                  const san = makeSan(posForSan, mv);
                  converted.push(san);
                  posForSan.play(mv);
                }
                sanList = converted;
              }

              if (sanList.length === 0) continue;

              const firstMove = sanList[0];
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

              // Helpers
              const fileToChar = (f: number) => String.fromCharCode("a".charCodeAt(0) + f);
              const rankToChar = (r: number) => String(r + 1);
              const squareToName = (sq: number | undefined) => {
                if (typeof sq !== "number") return undefined;
                const f = squareFile(sq);
                const r = squareRank(sq);
                return `${fileToChar(f)}${rankToChar(r)}`;
              };

              // Build sanMeta list and compute piece info for first move
              const posForMeta = pos.clone();
              const metaList: {
                san: string;
                pieceLetter: string;
                pieceColor: "white" | "black";
                fromSquare?: string;
                toSquare?: string;
                fromSquareColor?: "light" | "dark";
                toSquareColor?: "light" | "dark";
                iconFilename?: string;
                isCapture?: boolean;
                promotion?: "q" | "r" | "b" | "n";
              }[] = [];

              let pieceLetter: string = "";
              let pieceColor: "white" | "black" = pos.turn;
              let pieceSquareColor: "light" | "dark" = "light";

              for (const san of sanList) {
                const mv = parseSan(posForMeta, san) as any;
                if (!mv) break;
                const fromSq: any = mv.from;
                const toSq: any = mv.to;
                const piece = typeof fromSq === "number" ? posForMeta.board.get(fromSq) : null;
                let letter = "";
                let color: "white" | "black" = posForMeta.turn;
                let fromColor: "light" | "dark" | undefined = undefined;
                let toColor: "light" | "dark" | undefined = undefined;
                if (piece) {
                  color = piece.color;
                  switch (piece.role) {
                    case "pawn": letter = "p"; break;
                    case "knight": letter = "n"; break;
                    case "bishop": letter = "b"; break;
                    case "rook": letter = "r"; break;
                    case "queen": letter = "q"; break;
                    case "king": letter = "k"; break;
                    default: letter = "";
                  }
                }
                if (typeof fromSq === "number") {
                  const f = squareFile(fromSq);
                  const r = squareRank(fromSq);
                  fromColor = ((f + r) % 2 === 0) ? "dark" : "light";
                }
                if (typeof toSq === "number") {
                  const f = squareFile(toSq);
                  const r = squareRank(toSq);
                  toColor = ((f + r) % 2 === 0) ? "dark" : "light";
                }
                let icon: string | undefined = undefined;
                if (letter) {
                  const pc = color === "white" ? "l" : "d";
                  const sc = fromColor === "light" ? "l" : "d";
                  icon = `Chess_${letter}${pc}${sc}45.svg`;
                }
                const isCapture = san.includes("x");
                let promotion: "q" | "r" | "b" | "n" | undefined = undefined;
                if ((mv as any).promotion && (mv as any).promotion.role) {
                  const role = (mv as any).promotion.role as string;
                  if (role === "queen") promotion = "q";
                  else if (role === "rook") promotion = "r";
                  else if (role === "bishop") promotion = "b";
                  else if (role === "knight") promotion = "n";
                } else if (san.includes("=")) {
                  const ch = san.split("=")[1]?.[0]?.toLowerCase();
                  if (ch === "q" || ch === "r" || ch === "b" || ch === "n") promotion = ch as any;
                }

                metaList.push({
                  san,
                  pieceLetter: letter,
                  pieceColor: color,
                  fromSquare: squareToName(fromSq),
                  toSquare: squareToName(toSq),
                  fromSquareColor: fromColor,
                  toSquareColor: toColor,
                  iconFilename: icon,
                  isCapture,
                  promotion,
                });

                if (!pieceLetter && letter) {
                  pieceLetter = letter;
                  pieceColor = color;
                  pieceSquareColor = fromColor ?? "light";
                }
                posForMeta.play(mv);
              }

              // Explicit castling handling if letter not resolved from SAN
              if (!pieceLetter && /^O-O/.test(firstMove)) {
                pieceLetter = "k";
              }

              // Compute first-move icon filename if we have all metadata
              let iconFilename: string | undefined = undefined;
              if (pieceLetter) {
                const pc = pieceColor === "white" ? "l" : "d";
                const sc = pieceSquareColor === "light" ? "l" : "d";
                iconFilename = `Chess_${pieceLetter}${pc}${sc}45.svg`;
              }

              // Compute material delta after playing the entire PV
              const startDiff = getMaterialDiff(fen)?.diff ?? 0;
              const posForEnd = pos.clone();
              for (const san of sanList) {
                const mv = parseSan(posForEnd, san);
                if (!mv) break;
                posForEnd.play(mv as any);
              }
              const endFen = makeFen(posForEnd.toSetup());
              const endDiff = getMaterialDiff(endFen)?.diff ?? startDiff;
              const materialDelta = endDiff - startDiff;

              // Compute material gained/lost by side-to-move at start over the PV
              const countPieces = (c: typeof pos) => {
                const counts: Record<"white" | "black", Record<Role, number>> = {
                  white: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
                  black: { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 },
                };
                for (let sq = 0; sq < 64; sq++) {
                  const piece = c.board.get(sq as any);
                  if (piece) counts[piece.color][piece.role]++;
                }
                return counts;
              };
              const startCounts = countPieces(pos);
              const endCounts = countPieces(posForEnd);
              const startSide: "white" | "black" = pos.turn;
              const oppSide: "white" | "black" = startSide === "white" ? "black" : "white";
              const order: Role[] = ["pawn", "knight", "bishop", "rook", "queen"]; // exclude king
              const roleToLetter = (r: Role): string => (r === "pawn" ? "p" : r === "knight" ? "n" : r === "bishop" ? "b" : r === "rook" ? "r" : r === "queen" ? "q" : "k");
              let materialGained = "";
              let materialLost = "";
              for (const r of order) {
                const gainedCount = Math.max(0, startCounts[oppSide][r] - endCounts[oppSide][r]);
                const lostCount = Math.max(0, startCounts[startSide][r] - endCounts[startSide][r]);
                if (gainedCount > 0) materialGained += roleToLetter(r).repeat(gainedCount);
                if (lostCount > 0) materialLost += roleToLetter(r).repeat(lostCount);
              }

              const allEngineLinesData = {
                move: firstMove,
                san: firstMove,
                score: moveData.score,
                winChance,
                engineName,
                sanMoves: sanList,
                pv: moveData.uciMoves || [],
                depth: moveData.depth || 0,
                nodes: moveData.nodes || 0,
                isThreat: usedThreat,
                pieceLetter,
                pieceColor,
                pieceSquareColor,
                iconFilename,
                sanMeta: metaList,
                materialDelta,
                materialGained,
                materialLost,
              }
              // console.info('allEngineLinesData', allEngineLinesData);

              allEngineLines.push(allEngineLinesData);
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
            existing.pv = data.pv;
            existing.depth = data.depth;
            existing.nodes = data.nodes;
            existing.source = "both";
            existing.annotation = annotation;
            existing.isSacrifice = isSacrificeFlag;
            existing.isOnlyMove = isOnlyMoveFlag;
            existing.punishesMistake = punishesFlag;
            existing.isThreat = data.isThreat;
            existing.pieceLetter = data.pieceLetter;
            existing.pieceColor = data.pieceColor;
            existing.pieceSquareColor = data.pieceSquareColor;
            existing.iconFilename = data.iconFilename;
            existing.sanMeta = data.sanMeta;
            existing.materialDelta = data.materialDelta;
            existing.materialGained = data.materialGained;
            existing.materialLost = data.materialLost;
          } else {
            moveMap.set(move, {
              move,
              san: move,
              score: data.score,
              winChance: data.winChance,
              winDelta,
              engineName: data.engineName,
              sanMoves: data.sanMoves,
              pv: data.pv,
              depth: data.depth,
              nodes: data.nodes,
              annotation,
              isSacrifice: isSacrificeFlag,
              isOnlyMove: isOnlyMoveFlag,
              punishesMistake: punishesFlag,
              rank: rank++,
              source: "engine",
              isThreat: data.isThreat,
              pieceLetter: data.pieceLetter,
              pieceColor: data.pieceColor,
              pieceSquareColor: data.pieceSquareColor,
              iconFilename: data.iconFilename,
              sanMeta: data.sanMeta,
              materialDelta: data.materialDelta,
              materialGained: data.materialGained,
              materialLost: data.materialLost,
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

      // Compute confidence as a distribution derived solely from centipawn scores (0..100%)
      const movesForConfidence = Array.from(moveMap.values());
      // Collect normalized centipawn scores for side to move
      const cpList = movesForConfidence
        .map((m) => (m.score ? normalizeScore(m.score.value, currentTurn) : undefined))
        .filter((v): v is number => typeof v === "number");
      let withConfidence = movesForConfidence.map((m) => ({ ...m, confidence: 0 } as UnifiedMove));

      if (cpList.length > 0) {
        const maxCp = Math.max(...cpList);
        const tauCp = 100; // temperature in centipawns; lower -> sharper distribution
        const exps = movesForConfidence.map((m) => {
          if (!m.score) return 0;
          const cp = normalizeScore(m.score.value, currentTurn);
          return Math.exp((cp - maxCp) / Math.max(1e-6, tauCp));
        });
        const denom = exps.reduce((a, b) => a + b, 0) || 1;
        withConfidence = movesForConfidence.map((m, i) => ({
          ...m,
          confidence: denom > 0 ? (exps[i] / denom) * 100 : 0,
        }));
      }

      // Preserve previous sorting but attach confidence values
      const withConfidenceSorted = sorted.map((s) => {
        const found = withConfidence.find((m) => m.move === s.move);
        return found ? found : s;
      });

      // Compute PctBest = (confidence / bestConfidence) * 100
      const bestConfidence = withConfidence.reduce((acc, m) => {
        const v = m.confidence ?? 0;
        return v > acc ? v : acc;
      }, 0);
      if (bestConfidence > 0) {
        for (let i = 0; i < withConfidenceSorted.length; i++) {
          const m = withConfidenceSorted[i];
          const conf = m.confidence ?? 0;
          withConfidenceSorted[i] = {
            ...m,
            pctBest: Math.max(0, Math.min(100, (conf / bestConfidence) * 100)),
          } as UnifiedMove;
        }
      } else {
        for (let i = 0; i < withConfidenceSorted.length; i++) {
          withConfidenceSorted[i] = { ...withConfidenceSorted[i], pctBest: 0 } as UnifiedMove;
        }
      }

      const bestIdx = withConfidenceSorted.findIndex((m) => m.winChance !== undefined || m.score);
      if (bestIdx >= 0) {
        withConfidenceSorted[bestIdx] = { ...withConfidenceSorted[bestIdx], isBest: true };
      }

      // Recompute Rank: strictly by Eval Score (normalized CP for side to move)
      // Moves without an engine score are ranked after those with scores
      const rankedByEval = [...withConfidenceSorted].sort((a, b) => {
        const aCp = a.score ? normalizeScore(a.score.value, currentTurn) : Number.NEGATIVE_INFINITY;
        const bCp = b.score ? normalizeScore(b.score.value, currentTurn) : Number.NEGATIVE_INFINITY;
        return bCp - aCp;
      });
      const rankByMove = new Map<string, number>();
      let nextRank = 1;
      for (const m of rankedByEval) {
        rankByMove.set(m.move, nextRank++);
      }
      const withEvalRank = withConfidenceSorted.map((m) => ({
        ...m,
        rank: rankByMove.get(m.move) ?? nextRank++,
      }));

      // Debug logging (DEV only): print unified moves summary
      // if (import.meta.env.DEV) {
      //   try {
      //     // eslint-disable-next-line no-console
      //     console.groupCollapsed(
      //       `[UnifiedMoves] fen=${fen} moves=${moves.length} engines=${engines.length} threat=${usedThreat}`,
      //     );
      //     // eslint-disable-next-line no-console
      //     console.table(
      //       withEvalRank.map((m) => ({
      //         move: m.san || m.move,
      //         winChance: typeof m.winChance === "number" ? m.winChance.toFixed(1) : undefined,
      //         pctBest: typeof m.pctBest === "number" ? m.pctBest.toFixed(1) : undefined,
      //         confidence: typeof m.confidence === "number" ? m.confidence.toFixed(1) : undefined,
      //         total: m.total,
      //         source: m.source,
      //         engine: m.engineName,
      //         isBest: !!m.isBest,
      //         isThreat: !!m.isThreat,
      //         annotation: m.annotation,
      //         rank: m.rank,
      //         icon: m.iconFilename,
      //       })),
      //     );
      //     // eslint-disable-next-line no-console
      //     console.groupEnd();
      //   } catch {}
      // }
      return withEvalRank;
    }),
  (a, b) => a.rootFen === b.rootFen && a.fen === b.fen && a.tab === b.tab && a.moves.length === b.moves.length && a.moves.every((m, i) => m === b.moves[i]),
);

// Derived arrows for board drawing, built from the same engine data (threat-aware)
export const unifiedBoardArrowsFamily = atomFamily(
  ({ fen, gameMoves }: { fen: string; gameMoves: string[] }) =>
    atom<Map<number, { pv: string[]; winChance: number }[]>>((get) => {
      const tab = get(activeTabAtom);
      if (!tab) return new Map();
      const engines = get(enginesAtom).filter((e) => e.loaded);

      const bestMoves = new Map<number, { pv: string[]; winChance: number }[]>();
      let n = 0;
      for (const engine of engines) {
        const engineMoves = get(engineMovesFamily({ tab, engine: engine.name }));
        const engineSettings = get(
          tabEngineSettingsFamily({
            tab,
            engineName: engine.name,
            defaultSettings: engine.settings ?? undefined,
            defaultGo: engine.go ?? undefined,
          }),
        );
        const multiPvLimit = Number.parseInt(
          engineSettings.settings.find((s) => s.name === "MultiPV")?.value?.toString() ?? "5",
        );

        const [pos] = positionFromFen(fen);
        let finalFen = INITIAL_FEN;
        if (pos) {
          for (const move of gameMoves) {
            const m = parseUci(move);
            if (m) pos.play(m);
          }
          finalFen = makeFen(pos.toSetup());
        }
        const moves =
          engineMoves.get(`${swapMove(finalFen)}:`) ||
          engineMoves.get(`${fen}:${gameMoves.join(",")}`);
        if (moves && moves.length > 0) {
          const bestWinChance = getWinChance(
            normalizeScore(moves[0].score.value, pos?.turn || "white"),
          );
          const effectiveMoves = moves.slice(0, Math.min(moves.length, multiPvLimit));
          const arr = effectiveMoves.reduce<{ pv: string[]; winChance: number }[]>((acc, m) => {
            const winChance = getWinChance(
              normalizeScore(m.score.value, pos?.turn || "white"),
            );
            if (bestWinChance - winChance < 10) {
              acc.push({ pv: m.uciMoves, winChance });
            }
            return acc;
          }, []);
          if (arr.length > 0) bestMoves.set(n, arr);
        }
        n++;
      }
      return bestMoves;
    }),
  (a, b) => a.fen === b.fen && a.gameMoves.length === b.gameMoves.length && a.gameMoves.every((m, i) => m === b.gameMoves[i]),
); 