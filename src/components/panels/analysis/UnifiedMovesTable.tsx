import { TreeStateContext } from "@/components/common/TreeStateContext";
import MoveCell from "@/components/common/MoveCell";
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
import { makeSan, parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";
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
import { normalizeScore, getWinChance, formatScore } from "@/utils/score";
import {
  Badge,
  Group,
  Progress,
  Text,
  Stack,
  Tabs,
  ScrollArea,
  SegmentedControl,
  Box,
  Flex,
  ActionIcon,
  Table,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useContext, useEffect, useMemo, useState } from "react";
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

// Enhanced unified move data combining database stats and engine analysis
interface UnifiedMove {
  move: string;
  san: string;
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
  sanMoves?: string[];
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

// Component for displaying engine variation moves
function EngineVariationMoves({
  moves,
  rootFen,
  currentMoves,
  score,
  halfMoves,
}: {
  moves: string[];
  rootFen: string;
  currentMoves: string[];
  score: any;
  halfMoves: number;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [pos] = positionFromFen(rootFen);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);
  
  if (!pos) return null;

  const displayMoves = open ? moves : moves.slice(0, 6);
  const moveInfo = [];
  const currentPos = pos.clone();
  
  // First play the current moves to get to the current position
  for (const uci of currentMoves) {
    const move = parseUci(uci);
    if (!move) break;
    currentPos.play(move);
  }
  
  // Then calculate the engine variation moves from current position
  for (const san of displayMoves) {
    const move = parseSan(currentPos, san);
    if (!move) break;
    currentPos.play(move);
    const newFen = makeFen(currentPos.toSetup());
    const isCheck = currentPos.isCheck();
    moveInfo.push({ fen: newFen, san, isCheck });
  }

  return (
    <Flex direction="row" wrap="wrap" align="center" gap="xs">
      <ScoreBubble size="sm" score={score} />
      <Flex direction="row" wrap="wrap" align="center" style={{ 
        maxHeight: open ? "none" : "2rem", 
        overflow: "hidden" 
      }}>
        {moveInfo.map(({ san }, index) => {
          // Calculate move number based on current position + engine variation index
          const total_moves = halfMoves + currentMoves.length + index + 1;
          const is_white = total_moves % 2 === 1;
          const move_number = Math.ceil(total_moves / 2);
          
          return (
            <Box key={index} style={{ display: "flex", alignItems: "center" }}>
              {(index === 0 || is_white) && (
                <Text size="sm" c="dimmed" mr={2}>
                  {`${move_number}${is_white ? "." : "..."}`}
                </Text>
              )}
              <MoveCell
                move={san}
                isCurrentVariation={false}
                annotations={[]}
                onContextMenu={() => undefined}
                isStart={false}
                onClick={() => {
                  // Make moves from root: current moves + engine moves up to this point
                  const fullMoveSequence = [...currentMoves, ...moves.slice(0, index + 1)];
                  makeMoves({ payload: fullMoveSequence });
                }}
              />
            </Box>
          );
        })}
      </Flex>
      {moves.length > 6 && (
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={() => setOpen(!open)}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms ease",
          }}
        >
          <IconChevronDown size={12} />
        </ActionIcon>
      )}
    </Flex>
  );
}

function UnifiedMovesTable() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const halfMoves = useStore(store, (s) => s.currentNode().halfMoves);
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

  // Combine all engine moves data
  const allEngineMoves = useMemo(() => {
    const engineMovesList = [engineMoves1, engineMoves2, engineMoves3, engineMoves4];
    const combined = new Map<string, any[]>();
    
    engineMovesList.forEach((engineMoves, index) => {
      if (index < loadedEngines.length && engineMoves.size > 0) {
        const engine = loadedEngines[index];
        // Use the same key format as EvalListener: root FEN + moves to current position
        const key = `${rootFen}:${moves.join(",")}`;
        const movesData = engineMoves.get(key);
        
        if (movesData && movesData.length > 0) {
          combined.set(engine.name, movesData);
        }
      }
    });
    
    return combined;
  }, [engineMoves1, engineMoves2, engineMoves3, engineMoves4, loadedEngines, rootFen, moves]);

  // Combine database and engine data
  const unifiedMoves = useMemo((): UnifiedMove[] => {
    const moveMap = new Map<string, UnifiedMove>();
    let rank = 1;
    const [pos] = positionFromFen(fen);

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
          san: opening.move,
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

      // Collect all engine moves from actual engine data
      for (const [engineName, movesData] of allEngineMoves.entries()) {
        for (const moveData of movesData) {
          if (moveData.sanMoves && moveData.sanMoves.length > 0) {
            const firstMove = moveData.sanMoves[0];
            const winChance = moveData.score ? getWinChance(
              normalizeScore(moveData.score.value, pos.turn)
            ) : 50;
            
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
        if (existing) {
          // Merge with database data
          existing.score = data.score;
          existing.winChance = data.winChance;
          existing.engineName = data.engineName;
          existing.sanMoves = data.sanMoves;
          existing.depth = data.depth;
          existing.nodes = data.nodes;
          existing.source = "both";
        } else {
          // Engine-only move
          moveMap.set(move, {
            move,
            san: move,
            score: data.score,
            winChance: data.winChance,
            engineName: data.engineName,
            sanMoves: data.sanMoves,
            depth: data.depth,
            nodes: data.nodes,
            rank: rank++,
            source: "engine",
          });
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
        <Text size="xs" c="dimmed">
          {unifiedMoves.length} moves
        </Text>
      </Group>

      {/* Unified moves table */}
      <ScrollArea flex={1}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Move</Table.Th>
              <Table.Th>Analysis</Table.Th>
              <Table.Th>Games</Table.Th>
              <Table.Th>Results</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {unifiedMoves.map((move, index) => (
              <Table.Tr 
                key={move.move} 
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const [pos] = positionFromFen(fen);
                  if (pos) {
                    const parsedMove = parseSan(pos, move.san);
                    if (parsedMove) {
                      makeMove({ payload: parsedMove });
                    }
                  }
                }}
              >
                <Table.Td>
                  <MoveCell
                    move={moveNotationType === "symbols" ? addPieceSymbol(move.san) : move.san}
                    isCurrentVariation={false}
                    annotations={[]}
                    onContextMenu={() => undefined}
                    isStart={false}
                    onClick={() => {}}
                  />
                </Table.Td>
                
                <Table.Td>
                  {move.sanMoves && move.sanMoves.length > 0 ? (
                    <EngineVariationMoves
                      moves={move.sanMoves}
                      rootFen={rootFen}
                      currentMoves={moves}
                      score={move.score}
                      halfMoves={halfMoves}
                    />
                  ) : (
                    move.score && <ScoreBubble size="sm" score={move.score} />
                  )}
                </Table.Td>

                <Table.Td>
                  {move.total ? (
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {formatNumber(move.total)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        ({move.percentage?.toFixed(1)}%)
                      </Text>
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">-</Text>
                  )}
                </Table.Td>

                <Table.Td>
                  {move.total ? (
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Badge size="xs" color="gray" variant="light">
                          {((move.white! / move.total!) * 100).toFixed(0)}%
                        </Badge>
                        <Badge size="xs" color="dark" variant="light">
                          {((move.draw! / move.total!) * 100).toFixed(0)}%
                        </Badge>
                        <Badge size="xs" color="red" variant="light">
                          {((move.black! / move.total!) * 100).toFixed(0)}%
                        </Badge>
                      </Group>
                      {grandTotal > 0 && (
                        <Progress
                          size="xs"
                          value={(move.total! / grandTotal) * 100}
                          color="blue"
                        />
                      )}
                    </Stack>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}

export default memo(UnifiedMovesTable); 