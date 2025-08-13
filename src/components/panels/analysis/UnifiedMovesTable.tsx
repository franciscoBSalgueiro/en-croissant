import { TreeStateContext } from "@/components/common/TreeStateContext";
import MoveCell from "@/components/common/MoveCell";
import {
  activeTabAtom,
  currentAnalysisTabAtom,
  moveNotationTypeAtom,
} from "@/state/atoms";
import { addPieceSymbol } from "@/utils/annotation";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeSan, parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";

import {
  Badge,
  Group,
  Text,
  Stack,
  Box,
  Flex,
  ActionIcon,
  Image,
} from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import ScoreBubble from "./ScoreBubble";
import { ANNOTATION_INFO, type Annotation } from "@/utils/annotation";

// AG Grid imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from 'ag-grid-community';
import type { GridOptions } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Import unified moves aggregator
import { unifiedMovesFamily, type UnifiedMove } from "@/state/unifiedMoves";
import { loadable } from "jotai/utils";

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

// Icon cell renderer: renders the /public/svg/{iconFilename}
function IconCellRenderer(props: any) {
  const { data } = props;
  const filename: string | undefined = data?.iconFilename;
  if (!filename) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }
  const src = `/svg/${filename}`;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={src} alt={filename} style={{ width: 24, height: 24 }} />
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
      {data.pv && data.pv.length > 0 ? (
        <EngineVariationMoves
          moves={data.pv}
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

// New: Custom cell renderer for confidence
function ConfidenceCellRenderer(props: any) {
  const { data } = props;
  const value: number | undefined = data.confidence;
  const color = value !== undefined ? (value >= 80 ? "green" : value >= 50 ? "yellow" : "red") : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value !== undefined ? (
        <Badge size="sm" color={color} variant="light">
          {value.toFixed(1)}%
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

  if (!data?.annotation && !data?.isBest && !data?.isOnlyMove && !data?.punishesMistake && !data?.isSacrifice && !data?.isThreat) {
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
  if (data.isThreat) {
    badges.push(
      <Badge key="threat" size="sm" color="grape" variant="light">
        Threat
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

  // Prefer SAN moves; if absent, convert PV (UCI) to SAN from current position
  let sanMoves: string[] = Array.isArray(data?.sanMoves) ? data.sanMoves : [];
  if ((!sanMoves || sanMoves.length === 0) && Array.isArray(data?.pv) && data.pv.length > 0) {
    const [pos0] = positionFromFen(fen);
    if (pos0) {
      const posCopy = pos0.clone();
      const converted: string[] = [];
      for (const uci of data.pv as string[]) {
        const mv = parseUci(uci);
        if (!mv) break;
        const san = makeSan(posCopy, mv);
        converted.push(san);
        posCopy.play(mv);
      }
      sanMoves = converted;
    }
  }
  
  if (!sanMoves || sanMoves.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <MoveLineDisplay
        moves={sanMoves}
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

// Generic number renderer (uses value)
function NumberCellRenderer(props: any) {
  const { value } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {typeof value === 'number' ? (
        <Text size="sm" fw={500}>{value.toLocaleString()}</Text>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Nodes renderer with compact formatting
function NodesCellRenderer(props: any) {
  const { value } = props;
  const format = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  };
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {typeof value === 'number' ? (
        <Text size="sm" fw={500}>{format(value)}</Text>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

// Source renderer (database / engine / both)
function SourceCellRenderer(props: any) {
  const { value } = props;
  const label = value === 'both' ? 'Both' : value === 'engine' ? 'Engine' : value === 'database' ? 'Database' : undefined;
  const color = value === 'both' ? 'green' : value === 'engine' ? 'pink' : value === 'database' ? 'gray' : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {label ? (
        <Badge size="sm" color={color} variant="light">{label}</Badge>
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

// Custom cell renderer for PctBest (confidence relative to best)
function PctBestCellRenderer(props: any) {
  const { data } = props;
  const value: number | undefined = data.pctBest;
  const color = value !== undefined ? (value >= 80 ? "green" : value >= 50 ? "yellow" : "red") : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value !== undefined ? (
        <Badge size="sm" color={color} variant="light">
          {value.toFixed(1)}%
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

  const activeTab = useAtomValue(activeTabAtom);
  const currentAnalysisTab = useAtomValue(currentAnalysisTabAtom);

  // Use shared unified moves aggregator
  const unifiedAtom = useMemo(
    () => loadable(unifiedMovesFamily({ rootFen, fen, moves, tab: activeTab! })),
    [rootFen, fen, moves, activeTab]
  );
  const unifiedLoadable = useAtomValue(unifiedAtom);
  const unifiedMoves: UnifiedMove[] =
    unifiedLoadable.state === "hasData" ? unifiedLoadable.data : [];

  // AG Grid options
  const gridOptions: GridOptions<UnifiedMove> = {
    theme: darkTheme,
    animateRows: true,
    suppressScrollOnNewData: true,
    suppressRowVirtualisation: false,
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
    onGridReady: (params) => {
      const apiAny = params.api as any;
      if (typeof apiAny.applyColumnState === 'function') {
        apiAny.applyColumnState({
          defaultState: { sort: null },
          state: [
            { colId: 'rank', sort: 'asc', sortIndex: 0 },
          ],
        });
      } else if (typeof apiAny.setSortModel === 'function') {
        apiAny.setSortModel([{ colId: 'rank', sort: 'asc' }]);
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
        headerName: "Icon",
        field: "iconFilename",
        width: 70,
        cellRenderer: IconCellRenderer,
        sortable: false,
      },
      {
        headerName: "Rank",
        field: "rank",
        width: 90,
        cellRenderer: NumberCellRenderer,
        sortable: true,
        sort: 'asc',
      },
      {
        headerName: "Eval Score",
        field: "score",
        width: 100,
        cellRenderer: ScoreCellRenderer,
        sortable: true,
      },
      {
        headerName: "Annotation",
        field: "annotation",
        width: 160,
        cellRenderer: AnnotationCellRenderer,
        sortable: false,
      },
      {
        headerName: "Confidence",
        field: "confidence",
        width: 120,
        cellRenderer: ConfidenceCellRenderer,
        sortable: true,
      },
      {
        headerName: "PctBest",
        field: "pctBest",
        width: 110,
        cellRenderer: PctBestCellRenderer,
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
    ],
    onRowClicked: (event) => {
      // Row click is handled by the move cell renderer
    },
  };

  return (
    <Stack h="100%" gap="xs" style={{ minHeight: 0 }}>
      <Text size="sm" fw={500}>
        Unified Moves ({unifiedMoves.length} moves)
      </Text>
      
      <div style={{ height: '100%', width: '100%', flex: 1, minHeight: 300 }}>
        <AgGridReact<UnifiedMove>
          rowData={unifiedMoves}
          gridOptions={gridOptions}
          domLayout="normal"
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