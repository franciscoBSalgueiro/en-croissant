import { TreeStateContext } from "@/components/common/TreeStateContext";
import MoveCell from "@/components/common/MoveCell";
import {
  activeTabAtom,
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
  depth?: number;
  nodes?: number;
  engineName?: string;
  pv?: string[];
  sanMoves?: string[];
  // Annotation
  annotation?: Annotation;
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

// Custom cell renderer for annotation
function AnnotationCellRenderer(props: any) {
  const { data } = props;
  // ANNOTATION_INFO imported at top

  if (!data.annotation) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }

  const info = ANNOTATION_INFO[data.annotation as Annotation];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Badge size="sm" color={info?.color || 'gray'} variant="light">
        {info?.name || data.annotation}
      </Badge>
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
    if (allEngineMoves.size > 0) {
      const preferredName = loadedEngines[0]?.name;
      if (preferredName && allEngineMoves.has(preferredName)) {
        primaryEngineMoves = allEngineMoves.get(preferredName) as any;
      } else {
        // fallback to any engine's data
        const first = Array.from(allEngineMoves.values())[0];
        primaryEngineMoves = first as any;
      }
    }

    // Compute prev evaluation score for current position using primary engine (top line)
    const prevScoreValue: ScoreValue | undefined = primaryEngineMoves && primaryEngineMoves.length > 0
      ? primaryEngineMoves[0].score.value
      : undefined;

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
        // Compute annotation if possible
        let annotation: Annotation | undefined = undefined;
        if (prevScoreValue && data.score) {
          const prevCP = normalizeScore(prevScoreValue, currentTurn);
          const nextCP = normalizeScore(data.score.value, currentTurn);
          const isSacrifice = nextCP < prevCP; // worse eval than before move
          annotation = getAnnotation(
            null,
            prevScoreValue,
            data.score.value,
            currentTurn,
            (primaryEngineMoves || []) as BestMoves[],
            isSacrifice,
            move,
          );
        }

        if (existing) {
          // Merge with database data
          existing.score = data.score;
          existing.winChance = data.winChance;
          existing.engineName = data.engineName;
          existing.sanMoves = data.sanMoves;
          existing.depth = data.depth;
          existing.nodes = data.nodes;
          existing.source = "both";
          existing.annotation = annotation;
        } else {
          // Add as engine-only move
          moveMap.set(move, {
            move,
            san: move,
            score: data.score,
            winChance: data.winChance,
            engineName: data.engineName,
            sanMoves: data.sanMoves,
            depth: data.depth,
            nodes: data.nodes,
            annotation,
            rank: rank++,
            source: "engine",
          });
        }
      }
    }

    // Sort by engine analysis first, then by database frequency
    return Array.from(moveMap.values()).sort((a, b) => {
      // Engine analysis first (ascending for black, descending for white)
      if (a.winChance !== undefined && b.winChance !== undefined) {
        return currentTurn === "black" 
          ? a.winChance - b.winChance  // ascending for black (worse for white = better for black)
          : b.winChance - a.winChance; // descending for white (higher win chance first)
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
  }, [openingData, allEngineMoves, pos, currentTurn, loadedEngines]);



  // AG Grid options with automatic sorting based on turn
  const gridOptions: GridOptions<UnifiedMove> = {
    theme: darkTheme,
    animateRows: true,
    pagination: false,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 20, 50],
    suppressHorizontalScroll: false,
    suppressMovableColumns: false,
    defaultColDef: {
      sortable: true,
      resizable: true,
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
        width: 120,
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
        headerName: "Line",
        field: "pv",
        width: 200,
        cellRenderer: LineCellRenderer,
        sortable: false,
      },
      {
        headerName: "Count in DB",
        field: "total",
        width: 100,
        cellRenderer: CountCellRenderer,
        sortable: true,
      },
      {
        headerName: "% in DB",
        field: "percentage",
        width: 80,
        cellRenderer: PercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "%Win",
        field: "whitePercentage",
        width: 70,
        cellRenderer: WinPercentageCellRenderer,
        sortable: true,
        sort: currentTurn === "white" ? "desc" : "asc", // Auto-sort based on turn
        sortIndex: 0, // Make this the primary sort
      },
      {
        headerName: "%Draw",
        field: "drawPercentage",
        width: 70,
        cellRenderer: DrawPercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "%Loss",
        field: "blackPercentage",
        width: 70,
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
      
      <div style={{ height: 400, width: '100%' }}>
        <AgGridReact<UnifiedMove>
          rowData={unifiedMoves}
          gridOptions={gridOptions}
        />
      </div>
    </Stack>
  );
}

export default memo(UnifiedMovesTable); 