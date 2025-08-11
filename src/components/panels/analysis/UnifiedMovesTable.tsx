import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  bestMovesFamily,
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLocalOptionsAtom,
  currentTabAtom,
  engineMovesFamily,
  enginesAtom,
  lichessOptionsAtom,
  masterOptionsAtom,
  moveNotationTypeAtom,
  referenceDbAtom,
} from "@/state/atoms";
import { addPieceSymbol } from "@/utils/annotation";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeSan } from "chessops/san";
import type { Opening } from "@/utils/db";
import { searchPosition } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import {
  convertToNormalized,
  getLichessGames,
  getMasterGames,
} from "@/utils/lichess/api";
import type {
  LichessGamesOptions,
  MasterGamesOptions,
} from "@/utils/lichess/explorer";
import { normalizeScore, getWinChance } from "@/utils/score";
import {
  Badge,
  Group,
  Progress,
  Text,
  Stack,
  Tabs,
  ScrollArea,
  SegmentedControl,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useAtom, useAtomValue } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr/immutable";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import ScoreBubble from "./ScoreBubble";

type DBType =
  | { type: "local"; options: LocalOptions }
  | { type: "lch_all"; options: LichessGamesOptions; fen: string }
  | { type: "lch_master"; options: MasterGamesOptions; fen: string };

export type LocalOptions = {
  path: string | null;
  fen: string;
  type: "exact" | "partial";
  player: number | null;
  color: "white" | "black";
  start_date?: string;
  end_date?: string;
};

// Unified move data combining database stats and engine analysis
interface UnifiedMove {
  move: string;
  // Database stats (when available)
  white?: number;
  black?: number;
  draw?: number;
  total?: number;
  percentage?: number;
  // Engine analysis (when available)
  score?: any;
  winChance?: number;
  depth?: number;
  nodes?: number;
  engineName?: string;
  pv?: string[];
  // Combined ranking
  rank: number;
  source: "database" | "engine" | "both";
}

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
      };
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
      };
    })
    .with({ type: "local" }, async ({ options }) => {
      if (!options.path) throw Error("Missing reference database");
      const positionData = await searchPosition(options, tab);
      return {
        openings: sortOpenings(positionData[0]),
        games: positionData[1],
      };
    })
    .exhaustive();
}

function UnifiedMovesTable() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );
  const makeMove = useStore(store, (s) => s.makeMove);

  const referenceDatabase = useAtomValue(referenceDbAtom);
  const [debouncedFen] = useDebouncedValue(fen, 50);
  const [lichessOptions, setLichessOptions] = useAtom(lichessOptionsAtom);
  const [masterOptions, setMasterOptions] = useAtom(masterOptionsAtom);
  const [localOptions, setLocalOptions] = useAtom(currentLocalOptionsAtom);
  const [db, setDb] = useAtom(currentDbTypeAtom);
  const [moveNotationType] = useAtom(moveNotationTypeAtom);

  const activeTab = useAtomValue(activeTabAtom);
  const engines = useAtomValue(enginesAtom);
  const loadedEngines = useMemo(
    () => engines.filter((e) => e.loaded),
    [engines],
  );

  // Get individual engine moves data
  const engineMovesData = useMemo(() => {
    const data = new Map<string, any>();
    return data;
  }, []);

  // Get engine moves for each loaded engine (always call hooks)
  const engineMoves1 = useAtomValue(loadedEngines.length > 0 ? engineMovesFamily({ engine: loadedEngines[0]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves2 = useAtomValue(loadedEngines.length > 1 ? engineMovesFamily({ engine: loadedEngines[1]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves3 = useAtomValue(loadedEngines.length > 2 ? engineMovesFamily({ engine: loadedEngines[2]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves4 = useAtomValue(loadedEngines.length > 3 ? engineMovesFamily({ engine: loadedEngines[3]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, fen: debouncedFen }));
    }
  }, [debouncedFen, setLocalOptions, setMasterOptions, setLichessOptions, db]);

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, path: referenceDatabase }));
    }
  }, [referenceDatabase, setLocalOptions, db]);

  const dbType: DBType = match(db)
    .with("local", (v) => ({
      type: v,
      options: localOptions,
    }))
    .with("lch_all", (v) => ({
      type: v,
      options: lichessOptions,
      fen: debouncedFen,
    }))
    .with("lch_master", (v) => ({
      type: v,
      options: masterOptions,
      fen: debouncedFen,
    }))
    .exhaustive();

  const tab = useAtomValue(currentTabAtom);

  // Get database openings data
  const {
    data: openingData,
    isLoading: dbLoading,
    error: dbError,
  } = useSWR(dbType, async (dbType: DBType) => {
    return fetchOpening(dbType, tab?.value || "");
  });

  // Get engine best moves data
  const arrows = useAtomValue(
    bestMovesFamily({
      fen: rootFen,
      gameMoves: moves,
    }),
  );

  // Combine all engine moves data
  const allEngineMoves = useMemo(() => {
    const engineMovesList = [engineMoves1, engineMoves2, engineMoves3, engineMoves4];
    const combined = new Map<string, any[]>();
    
    engineMovesList.forEach((engineMoves, index) => {
      if (index < loadedEngines.length && engineMoves.size > 0) {
        const engine = loadedEngines[index];
        // Look for moves at current position
        const key = `${fen}:${moves.join(",")}`;
        const movesData = engineMoves.get(key);
        if (movesData && movesData.length > 0) {
          combined.set(engine.name, movesData);
        }
      }
    });
    
    return combined;
  }, [engineMoves1, engineMoves2, engineMoves3, engineMoves4, loadedEngines, fen, moves]);

  // Combine database and engine data
  const unifiedMoves = useMemo((): UnifiedMove[] => {
    console.log('UnifiedMovesTable: Creating unified moves', {
      openingData: openingData?.openings?.length || 0,
      allEngineMovesSize: allEngineMoves.size,
      loadedEnginesCount: loadedEngines.length,
      fen,
      moves
    });
    const moveMap = new Map<string, UnifiedMove>();
    let rank = 1;

    // Add database moves
    if (openingData?.openings) {
      const grandTotal = openingData.openings.reduce(
        (acc, curr) => acc + curr.black + curr.white + curr.draw,
        0,
      );

      for (const opening of openingData.openings) {
        if (opening.move === "Total") continue;
        
        const total = opening.white + opening.black + opening.draw;
        const percentage = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
        
        moveMap.set(opening.move, {
          move: opening.move,
          white: opening.white,
          black: opening.black,
          draw: opening.draw,
          total,
          percentage,
          rank: rank++,
          source: "database",
        });
      }
    }

        // Add engine moves from actual engine data
    if (allEngineMoves.size > 0) {
      const [pos] = positionFromFen(fen);
      if (pos) {
        const allEngineLines: Array<{
          move: string;
          score: any;
          winChance: number;
          engineName: string;
          pv: string[];
          depth: number;
          nodes: number;
        }> = [];

        // Collect all engine moves from actual engine data
        for (const [engineName, movesData] of allEngineMoves.entries()) {
          console.log(`Engine ${engineName} moves:`, movesData);
          for (const moveData of movesData) {
            if (moveData.sanMoves && moveData.sanMoves.length > 0) {
              const firstMove = moveData.sanMoves[0];
              const winChance = moveData.score ? getWinChance(
                normalizeScore(moveData.score.value, pos.turn)
              ) : 50;
              
              allEngineLines.push({
                move: firstMove,
                score: moveData.score,
                winChance,
                engineName,
                pv: moveData.uciMoves || [],
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
          if (existing) {
            // Merge with database data
            existing.score = data.score;
            existing.winChance = data.winChance;
            existing.engineName = data.engineName;
            existing.pv = data.pv;
            existing.depth = data.depth;
            existing.nodes = data.nodes;
            existing.source = "both";
          } else {
            // Engine-only move
            moveMap.set(move, {
              move,
              score: data.score,
              winChance: data.winChance,
              engineName: data.engineName,
              pv: data.pv,
              depth: data.depth,
              nodes: data.nodes,
              rank: rank++,
              source: "engine",
            });
          }
        }
      }
    }

    // Sort by database frequency first, then by engine evaluation
    return Array.from(moveMap.values()).sort((a, b) => {
      // Database moves first (by total games)
      if (a.total && b.total) {
        return b.total - a.total;
      }
      if (a.total && !b.total) return -1;
      if (!a.total && b.total) return 1;
      
      // Then by engine evaluation (win chance)
      if (a.winChance !== undefined && b.winChance !== undefined) {
        return b.winChance - a.winChance;
      }
      if (a.winChance !== undefined) return -1;
      if (b.winChance !== undefined) return 1;
      
      return 0;
    });
  }, [openingData, allEngineMoves, fen, loadedEngines]);

  const grandTotal = openingData?.openings?.reduce(
    (acc, curr) => acc + curr.black + curr.white + curr.draw,
    0,
  ) || 0;

  return (
    <Stack h="100%" gap={0}>
      {/* Database selection controls */}
      <Group justify="space-between" p="xs">
        <SegmentedControl
          data={[
            { label: t("Board.Database.Local"), value: "local" },
            { label: t("Board.Database.LichessAll"), value: "lch_all" },
            { label: t("Board.Database.LichessMaster"), value: "lch_master" },
          ]}
          value={db}
          onChange={(value: string) =>
            setDb(value as "local" | "lch_all" | "lch_master")
          }
          size="xs"
        />
        <Text fz="xs" c="dimmed">
          {grandTotal > 0 && `${formatNumber(grandTotal)} games`}
          {allEngineMoves.size > 0 && ` • ${allEngineMoves.size} engines`}
        </Text>
      </Group>
      
      <ScrollArea h="100%" offsetScrollbars>
        <DataTable
          withTableBorder
          highlightOnHover
          records={unifiedMoves}
          fetching={dbLoading}
          columns={[
            {
              accessor: "move",
              width: 120,
              render: ({ move }) => (
                <Group gap="xs">
                  <Text fz="sm" fw={500}>
                    {moveNotationType === "symbols" ? addPieceSymbol(move) : move}
                  </Text>
                </Group>
              ),
            },
            {
              accessor: "source",
              width: 80,
              render: ({ source }) => (
                <Badge
                  size="xs"
                  variant="light"
                  color={
                    source === "both" ? "blue" :
                    source === "database" ? "green" : "orange"
                  }
                >
                  {source === "both" ? "DB+AI" :
                   source === "database" ? "DB" : "AI"}
                </Badge>
              ),
            },
            {
              accessor: "evaluation",
              width: 100,
              render: ({ score, winChance }) => (
                <Group gap="xs">
                  {score && <ScoreBubble size="sm" score={score} />}
                  {winChance !== undefined && (
                    <Text fz="xs" c="dimmed">
                      {winChance.toFixed(1)}%
                    </Text>
                  )}
                </Group>
              ),
            },
            {
              accessor: "stats",
              width: 200,
              render: ({ white, draw, black, total, percentage }) => {
                if (!total) return null;
                
                const whitePercent = (white! / total) * 100;
                const drawPercent = (draw! / total) * 100;
                const blackPercent = (black! / total) * 100;
                
                return (
                  <Group gap="xs">
                    <Text fz="sm" w={40}>
                      {percentage!.toFixed(0)}%
                    </Text>
                    <Progress.Root size="md" w={120}>
                      <Progress.Section value={whitePercent} color="white">
                        <Progress.Label c="black">
                          {whitePercent > 15 ? `${whitePercent.toFixed(0)}%` : ""}
                        </Progress.Label>
                      </Progress.Section>
                      <Progress.Section value={drawPercent} color="gray">
                        <Progress.Label>
                          {drawPercent > 15 ? `${drawPercent.toFixed(0)}%` : ""}
                        </Progress.Label>
                      </Progress.Section>
                      <Progress.Section value={blackPercent} color="black">
                        <Progress.Label>
                          {blackPercent > 15 ? `${blackPercent.toFixed(0)}%` : ""}
                        </Progress.Label>
                      </Progress.Section>
                    </Progress.Root>
                  </Group>
                );
              },
            },
            {
              accessor: "total",
              width: 80,
              render: ({ total }) => (
                total ? (
                  <Text fz="sm" ta="right">
                    {formatNumber(total)}
                  </Text>
                ) : null
              ),
            },
            {
              accessor: "engine",
              width: 100,
              render: ({ engineName }) => (
                engineName ? (
                  <Text fz="xs" c="dimmed">
                    {engineName}
                  </Text>
                ) : null
              ),
            },
          ]}
          idAccessor="move"
          emptyState={dbLoading ? "Loading moves..." : "No moves found"}
          onRowClick={({ record }) => makeMove({ payload: record.move })}
        />
      </ScrollArea>
    </Stack>
  );
}

export default memo(UnifiedMovesTable); 