import { TreeStateContext } from "@/components/common/TreeStateContext";
import MoveCell from "@/components/common/MoveCell";
import {
  activeTabAtom,
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLocalOptionsAtom,
  currentTabAtom,
  currentAnalysisTabAtom,
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
import { normalizeScore, getWinChance } from "@/utils/score";
import { type Opening, searchPosition } from "@/utils/db";
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
import {
  Badge,
  Group,
  Text,
  Stack,
  Box,
  Flex,
  ActionIcon,
} from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr/immutable";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import ScoreBubble from "./ScoreBubble";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { getAnnotation } from "@/utils/score";
import type { BestMoves, ScoreValue } from "@/bindings";

// AG Grid imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from 'ag-grid-community';
import type { ColDef, GridOptions } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Database types from DatabasePanel
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

// Custom cell renderer for move notation
function MoveCellRenderer(props: any) {
  const { value, data } = props;
  const [moveNotationType] = useAtom(moveNotationTypeAtom);
  
  const store = useContext(TreeStateContext);
  const makeMove = useStore(store!, (s) => s.makeMove);
  const fen = useStore(store!, (s) => s.currentNode().fen);

  const handleClick = () => {
    if (!fen || !data?.san) return;
    const [pos] = positionFromFen(fen);
    if (pos) {
      const parsedMove = parseSan(pos, data.san);
      if (parsedMove) {
        makeMove({ payload: parsedMove });
      }
    }
  };

  const displayValue = value || data?.san || '';
  const moveText = moveNotationType === "symbols" ? addPieceSymbol(displayValue) : displayValue;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <MoveCell
        move={moveText}
        isCurrentVariation={false}
        annotations={[]}
        onContextMenu={() => undefined}
        isStart={false}
        onClick={handleClick}
      />
    </div>
  );
}

// Custom cell renderer for engine analysis
function AnalysisCellRenderer(props: any) {
  const { data } = props;
  const store = useContext(TreeStateContext);
  const rootFen = useStore(store!, (s) => s.root.fen);
  const moves = useStore(store!, useShallow((s) => getVariationLine(s.root, s.position, false)));
  const halfMoves = useStore(store!, (s) => s.currentNode().halfMoves);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      {data.sanMoves && data.sanMoves.length > 0 ? (
        <EngineVariationMoves
          moves={data.sanMoves}
          rootFen={rootFen}
          currentMoves={moves}
          score={data.score}
          halfMoves={halfMoves}
        />
      ) : data.score ? (
        <ScoreBubble size="sm" score={data.score} />
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for win chance
function WinChanceCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.winChance !== undefined ? (
        <Badge size="sm" color={data.winChance > 60 ? "green" : data.winChance > 40 ? "yellow" : "red"} variant="light">
          {data.winChance.toFixed(1)}%
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for Win Likelihood delta
function WinDeltaCellRenderer(props: any) {
  const { data } = props;
  const value: number | undefined = data.winDelta;
  const color = value !== undefined ? (value > 0.1 ? "green" : value < -0.1 ? "red" : "gray") : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value !== undefined ? (
        <Badge size="sm" color={color} variant="light">
          {(value > 0 ? "+" : "") + value.toFixed(2)}%
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for evaluation score
function ScoreCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.score ? (
        <ScoreBubble size="sm" score={data.score} />
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Generic boolean badge renderer
function BooleanCellRenderer(props: any) {
  const { value } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value ? (
        <Badge size="sm" color="teal" variant="light">Yes</Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for annotation
function AnnotationCellRenderer(props: any) {
  const { data } = props;
  // ANNOTATION_INFO imported at top

  if (!data?.annotation && !data?.isBest && !data?.isOnlyMove && !data?.punishesMistake && !data?.isSacrifice) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }

  const badges: JSX.Element[] = [];
  if (data.isBest && (data.winChance !== undefined || data.score)) {
    badges.push(
      <Badge key="best" size="sm" color="blue" variant="light">
        Best
      </Badge>
    );
  }
  if (data.annotation) {
    const info = ANNOTATION_INFO[data.annotation as Annotation];
    badges.push(
      <Badge key="ann" size="sm" color={info?.color || 'gray'} variant="light">
        {info?.name || data.annotation}
      </Badge>
    );
  }
  if (data.isOnlyMove) {
    badges.push(
      <Badge key="only" size="sm" color="cyan" variant="light">
        Only
      </Badge>
    );
  }
  if (data.punishesMistake) {
    badges.push(
      <Badge key="punish" size="sm" color="teal" variant="light">
        Punish
      </Badge>
    );
  }
  if (data.isSacrifice) {
    badges.push(
      <Badge key="sac" size="sm" color="orange" variant="light">
        Sac
      </Badge>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {badges}
    </div>
  );
}

// Component for displaying move line with hover functionality (based on AnalysisRow)
function MoveLineDisplay({
  moves,
  fen,
  halfMoves,
}: {
  moves: string[];
  fen: string;
  halfMoves: number;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);

  if (!open) {
    moves = moves.slice(0, 8);
  }
  
  const [pos] = positionFromFen(fen);
  const moveInfo = [];
  
  if (pos) {
    for (const san of moves) {
      const move = parseSan(pos, san);
      if (!move) break;
      pos.play(move);
      const newFen = makeFen(pos.toSetup());
      const isCheck = pos.isCheck();
      moveInfo.push({ fen: newFen, san, isCheck });
    }
  }

  return (
    <Flex
      direction="row"
      wrap="wrap"
      style={{
        height: open ? "100%" : 35,
        overflow: "hidden",
        alignItems: "center",
      }}
      gap="xs"
    >
      {moveInfo.map(({ san }, index) => {
        const total_moves = halfMoves + index + 1;
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
                // Play moves up to this point
                const moveSequence = moves.slice(0, index + 1);
                makeMoves({ payload: moveSequence });
              }}
            />
          </Box>
        );
      })}
      {moves.length > 8 && (
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

// Custom cell renderer for move line (principal variation)
function LineCellRenderer(props: any) {
  const { data } = props;
  const store = useContext(TreeStateContext);
  const fen = useStore(store!, (s) => s.currentNode().fen);
  const halfMoves = useStore(store!, (s) => s.currentNode().halfMoves);

  // Use the PV (principal variation) from the engine analysis
  const moves = data.pv || data.sanMoves || [];
  
  if (!moves || moves.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <MoveLineDisplay
        moves={moves}
        fen={fen}
        halfMoves={halfMoves}
      />
    </div>
  );
}

// Custom cell renderer for database count
function CountCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.total ? (
        <Text size="sm" fw={500}>
          {data.total.toLocaleString()}
        </Text>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for database percentage
function PercentageCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.percentage !== undefined ? (
        <Text size="sm">
          {data.percentage.toFixed(1)}%
        </Text>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for win percentage
function WinPercentageCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.whitePercentage !== undefined ? (
        <Badge size="sm" color="gray" variant="light">
          {data.whitePercentage.toFixed(1)}%
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for draw percentage
function DrawPercentageCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.drawPercentage !== undefined ? (
        <Badge size="sm" color="yellow" variant="light">
          {data.drawPercentage.toFixed(1)}%
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for loss percentage
function LossPercentageCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.blackPercentage !== undefined ? (
        <Badge size="sm" color="red" variant="light">
          {data.blackPercentage.toFixed(1)}%
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Custom cell renderer for engine info
function EngineInfoCellRenderer(props: any) {
  const { data } = props;
  
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      {data.engineName ? (
        <Group gap="xs">
          <Text size="sm" fw={500}>
            {data.engineName}
          </Text>
          {data.depth && (
            <Text size="xs" c="dimmed">
              d{data.depth}
            </Text>
          )}
        </Group>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
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
  const [open, setOpen] = useState(false);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);

  const moveInfo: Array<{ fen: string; san: string; isCheck: boolean }> = [];

  let currentPos = (() => {
    const [pos] = positionFromFen(rootFen);
    if (!pos) return null;
    for (const uci of currentMoves) {
      const move = parseUci(uci);
      if (!move) return null;
      pos.play(move);
    }
    return pos;
  })();

  if (!currentPos) return null;

  for (const uci of moves) {
    const move = parseUci(uci);
    if (!move) break;
    
    const san = makeSan(currentPos, move);
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

  // Create dark theme using AG Grid's new theming system
  const darkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
    backgroundColor: 'var(--mantine-color-dark-7)',
    foregroundColor: 'var(--mantine-color-gray-1)',
    accentColor: 'var(--mantine-color-blue-6)',
    borderColor: 'var(--mantine-color-dark-4)',
    chromeBackgroundColor: 'var(--mantine-color-dark-6)',
    headerBackgroundColor: 'var(--mantine-color-dark-6)',
    oddRowBackgroundColor: 'var(--mantine-color-dark-8)',
    rowHoverColor: 'var(--mantine-color-dark-6)',
  });

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const rootFen = useStore(store, (s) => s.root.fen);
  const is960 = useStore(store, (s) => s.headers.variant === "Chess960");
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );

  // Get current position to determine turn
  const [pos] = positionFromFen(fen);
  const currentTurn = pos?.turn || "white";

  // Database integration
  const referenceDatabase = useAtomValue(referenceDbAtom);
  const [debouncedFen] = useDebouncedValue(fen, 50);
  const [lichessOptions, setLichessOptions] = useAtom(lichessOptionsAtom);
  const [masterOptions, setMasterOptions] = useAtom(masterOptionsAtom);
  const [localOptions, setLocalOptions] = useAtom(currentLocalOptionsAtom);
  const [db, setDb] = useAtom(currentDbTypeAtom);

  const activeTab = useAtomValue(activeTabAtom);
  const tab = useAtomValue(currentTabAtom);
  const currentAnalysisTab = useAtomValue(currentAnalysisTabAtom);

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

  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR(dbType, async (dbType: DBType) => {
    return fetchOpening(dbType, tab?.value || "");
  });
  const engines = useAtomValue(enginesAtom);
  const loadedEngines = useMemo(
    () => engines.filter((e) => e.loaded),
    [engines],
  );

  // Get engine moves for each loaded engine
  const engineMoves1 = useAtomValue(loadedEngines.length > 0 ? engineMovesFamily({ engine: loadedEngines[0]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves2 = useAtomValue(loadedEngines.length > 1 ? engineMovesFamily({ engine: loadedEngines[1]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves3 = useAtomValue(loadedEngines.length > 2 ? engineMovesFamily({ engine: loadedEngines[2]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));
  const engineMoves4 = useAtomValue(loadedEngines.length > 3 ? engineMovesFamily({ engine: loadedEngines[3]?.name || 'none', tab: activeTab! }) : engineMovesFamily({ engine: 'none', tab: activeTab! }));

  // Combine engine moves from all loaded engines
  const allEngineMoves = useMemo(() => {
    const engineMovesList = [engineMoves1, engineMoves2, engineMoves3, engineMoves4];
    const combined = new Map<string, any[]>();
    
    engineMovesList.forEach((engineMoves, index) => {
      if (index < loadedEngines.length && engineMoves.size > 0) {
        const engine = loadedEngines[index];
        const key = `${rootFen}:${moves.join(",")}`;
        const movesData = engineMoves.get(key);
        
        if (movesData && movesData.length > 0) {
          combined.set(engine.name, movesData);
        }
      }
    });
    
    return combined;
  }, [engineMoves1, engineMoves2, engineMoves3, engineMoves4, loadedEngines, rootFen, moves]);

  // Process engine data and database data into unified moves
  const unifiedMoves = useMemo((): UnifiedMove[] => {
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
        const whitePercentage = total > 0 ? (opening.white / total) * 100 : 0;
        const drawPercentage = total > 0 ? (opening.draw / total) * 100 : 0;
        const blackPercentage = total > 0 ? (opening.black / total) * 100 : 0;
        
        moveMap.set(opening.move, {
          move: opening.move,
          san: opening.move,
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
      const preferredName = loadedEngines[0]?.name;
      if (preferredName && allEngineMoves.has(preferredName)) {
        primaryEngineMoves = allEngineMoves.get(preferredName) as any;
        primaryEngineName = preferredName;
      } else {
        // fallback to any engine's data
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
      const engineMapsByIndex = [engineMoves1, engineMoves2, engineMoves3, engineMoves4];
      const primaryIndex = loadedEngines.findIndex((e) => e.name === primaryEngineName);
      const engineMap = primaryIndex >= 0 ? engineMapsByIndex[primaryIndex] : undefined;
      const prevBestMoves = engineMap?.get(prevKey);
      if (prevBestMoves && prevBestMoves.length > 0) {
        prevprevScoreValue = prevBestMoves[0].score.value;
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
    let isOnlyMoveTop: boolean = false;
    let punishesMistakeTop: boolean = false;
    if (primaryEngineMoves && primaryEngineMoves.length > 0 && pos) {
      topMoveSan = primaryEngineMoves[0]?.sanMoves?.[0];
      // Only-move: top vs second best win% gap > 10
      if (primaryEngineMoves.length > 1) {
        const a = primaryEngineMoves[0].score.value;
        const b = primaryEngineMoves[1].score.value;
        const aCP = normalizeScore(a, pos.turn);
        const bCP = normalizeScore(b, pos.turn);
        const gap = getWinChance(aCP) - getWinChance(bCP);
        isOnlyMoveTop = gap > 10;
      }
      // Punishes mistake: if prevprev available and top line improves > 5 win%
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

      // Collect all engine moves from actual engine data
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
          const isSacrifice = nextCP < prevCP; // worse eval than before move
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
          // sacrifice requires win chance to increase
          if (data.winChance <= baseWinChance) return false;

          // Track the moved piece and check if it's captured within next 5 plies of the PV
          const [startPos] = positionFromFen(fen);
          if (!startPos) return false;
          const first = parseSan(startPos, data.sanMoves[0]);
          if (!first || !('from' in (first as any)) || !('to' in (first as any))) return false;
          let pieceSquare: any = (first as any).to;
          const movedFrom: any = (first as any).from;
          // Validate we moved an actual piece
          const movedPieceBefore = startPos.board.get(movedFrom);
          if (!movedPieceBefore) return false;
          startPos.play(first as any);

          const maxPlies = Math.min(5, data.sanMoves.length - 1);
          for (let i = 1; i <= maxPlies; i++) {
            const san = data.sanMoves[i];
            const move = parseSan(startPos, san);
            if (!move) break;
            // If opponent to move and captures on our piece square
            const sideToMove = startPos.turn; // before playing 'move'
            if (pieceSquare !== undefined && sideToMove !== movedPieceBefore.color) {
              // If destination equals our piece square and there is our piece on that square before playing
              const toSq: any = (move as any).to;
              if (toSq !== undefined && toSq === pieceSquare) {
                // our moved piece got captured
                return true;
              }
            }
            // If we are moving our piece again, update its square
            if (pieceSquare !== undefined && sideToMove === movedPieceBefore.color) {
              const fromSq: any = (move as any).from;
              const toSq: any = (move as any).to;
              if (fromSq !== undefined && toSq !== undefined && fromSq === pieceSquare) {
                pieceSquare = toSq;
              }
            }
            startPos.play(move as any);
          }
          return false;
        })();
        const isOnlyMoveFlag = move === topMoveSan ? isOnlyMoveTop : false;
        const punishesFlag = move === topMoveSan ? punishesMistakeTop : false;

        if (existing) {
          // Merge with database data
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
          // Add as engine-only move
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
      // Engine analysis first: Win Likelihood descending regardless of side to move
      if (a.winChance !== undefined && b.winChance !== undefined) {
        return b.winChance - a.winChance;
      }
      if (a.winChance !== undefined) return -1; // engine moves before non-engine moves
      if (b.winChance !== undefined) return 1;
      
      // Then by database frequency (most played first)
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
  }, [openingData, allEngineMoves, pos, currentTurn, loadedEngines, engineMoves1, engineMoves2, engineMoves3, engineMoves4, rootFen, moves]);



  // AG Grid options with automatic sorting based on mode
  const gridOptions: GridOptions<UnifiedMove> = {
    theme: darkTheme,
    animateRows: true,
    suppressScrollOnNewData: true,
    suppressRowVirtualisation: false, // keep virtualization for performance
    pagination: false,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 20, 50],
    suppressHorizontalScroll: true,
    suppressMovableColumns: false,
    getRowId: (params) => params.data?.san || params.data?.move,
    defaultColDef: {
      sortable: true,
      resizable: true,
    },
    // Default sorting behavior: when in Analysis tab (engines), sort by Win Likelihood desc;
    // otherwise (database mode), sort by DB %Win desc.
    // We'll set column sorts dynamically via initial sort on grid ready.
    onGridReady: (params) => {
      const colApi = (params as any).columnApi ?? (params.api as any).setColumnState;
      if (colApi && typeof (params.api as any).applyColumnState === 'function') {
        // AG Grid v28+ API
        if (currentAnalysisTab === 'engines') {
          (params.api as any).applyColumnState({
            defaultState: { sort: null },
            state: [
              { colId: 'winChance', sort: 'desc', sortIndex: 0 },
            ],
          });
        } else {
          (params.api as any).applyColumnState({
            defaultState: { sort: null },
            state: [
              { colId: 'whitePercentage', sort: 'desc', sortIndex: 0 },
            ],
          });
        }
      } else if (typeof (params.api as any).setSortModel === 'function') {
        // Fallback
        if (currentAnalysisTab === 'engines') {
          (params.api as any).setSortModel([{ colId: 'winChance', sort: 'desc' }]);
        } else {
          (params.api as any).setSortModel([{ colId: 'whitePercentage', sort: 'desc' }]);
        }
      }
    },
    columnDefs: [

      {
        headerName: "Move",
        field: "san",
        width: 80,
        cellRenderer: MoveCellRenderer,
        pinned: 'left',
        valueGetter: (params) => params.data?.san || params.data?.move || '',
      },
      {
        headerName: "Annotation",
        field: "annotation",
        width: 125,
        cellRenderer: AnnotationCellRenderer,
        sortable: false,
      },
      {
        headerName: "Eval Score",
        field: "score",
        width: 100,
        cellRenderer: ScoreCellRenderer,
        sortable: true,
      },
      {
        headerName: "Win Likelihood",
        field: "winChance",
        width: 120,
        cellRenderer: WinChanceCellRenderer,
        sortable: true,
      },
      {
        headerName: "ΔWin%",
        field: "winDelta",
        width: 90,
        cellRenderer: WinDeltaCellRenderer,
        sortable: true,
      },
      {
        headerName: "Line",
        field: "pv",
        flex: 1,
        minWidth: 150,
        cellRenderer: LineCellRenderer,
        sortable: false,
      },
      {
        headerName: "#",
        field: "total",
        width: 80,
        cellRenderer: CountCellRenderer,
        sortable: true,
      },
      {
        headerName: "%",
        field: "percentage",
        width: 80,
        cellRenderer: PercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "%W",
        field: "whitePercentage",
        width: 100,
        cellRenderer: WinPercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "%D",
        field: "drawPercentage",
        width: 100,
        cellRenderer: DrawPercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "%B",
        field: "blackPercentage",
        width: 100,
        cellRenderer: LossPercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "Engine",
        field: "engineName",
        width: 100,
        cellRenderer: EngineInfoCellRenderer,
        sortable: false,
      },
    ],
    onRowClicked: (event) => {
      // Row click is handled by the move cell renderer
    },
  };

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm" fw={500}>
        Unified Moves ({unifiedMoves.length} moves)
      </Text>
      
      <div style={{ height: '50vh', width: '100%', flex: 1 }}>
        <AgGridReact<UnifiedMove>
          rowData={unifiedMoves}
          gridOptions={gridOptions}
          domLayout="autoHeight"
          suppressHorizontalScroll={true}
          suppressDragLeaveHidesColumns={true}
          suppressScrollOnNewData={true}
          suppressRowVirtualisation={true}
        />
      </div>
    </Stack>
  );
}

export default memo(UnifiedMovesTable); 