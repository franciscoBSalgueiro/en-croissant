import { useAtomValue } from "jotai";
import { activeTabAtom, moveNotationTypeAtom } from "@/state/atoms";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { useContext, useMemo, useState, memo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import MoveCell from "@/components/common/MoveCell";
import { addPieceSymbol, ANNOTATION_INFO, type Annotation } from "@/utils/annotation";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { parseUci } from "chessops";
import { makeSan, parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { Badge, Group, Text, Stack, Box, Flex, ActionIcon } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";

import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, colorSchemeDark } from 'ag-grid-community';
import type { GridOptions } from 'ag-grid-community';
import ScoreBubble from "./ScoreBubble";

ModuleRegistry.registerModules([AllCommunityModule]);

// Reuse renderers from UnifiedMovesTable
function MoveCellRenderer(props: any) {
  const { value, data } = props;
  const moveNotationType = useAtomValue(moveNotationTypeAtom);
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
      <MoveCell move={moveText} isCurrentVariation={false} annotations={[]} onContextMenu={() => undefined} isStart={false} onClick={handleClick} />
    </div>
  );
}

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

// Combined icon + move renderer
function CombinedMoveCellRenderer(props: any) {
  const { value, data } = props;
  const moveNotationType = useAtomValue(moveNotationTypeAtom);
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
  const filename: string | undefined = data?.iconFilename;
  const src = filename ? `/svg/${filename}` : null;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
      {src && <img src={src} alt={filename || ''} style={{ width: 20, height: 20 }} />}
      <MoveCell move={moveText} isCurrentVariation={false} annotations={[]} onContextMenu={() => undefined} isStart={false} onClick={handleClick} />
    </div>
  );
}

function ScoreCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.score ? <ScoreBubble size="sm" score={data.score} /> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function NumberCellRenderer(props: any) {
  const { value } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {typeof value === 'number' ? <Text size="sm" fw={500}>{value.toLocaleString()}</Text> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function WinChanceCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.winChance !== undefined ? (
        <Badge size="sm" color={data.winChance > 60 ? 'green' : data.winChance > 40 ? 'yellow' : 'red'} variant="light">{data.winChance.toFixed(1)}%</Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

function ConfidenceCellRenderer(props: any) {
  const { data } = props;
  const kind: 'confidence' | 'pctBest' = (props?.colDef?.cellRendererParams?.type === 'pctBest') ? 'pctBest' : 'confidence';
  const raw: number | undefined = kind === 'pctBest' ? data?.pctBest : data?.confidence;
  const value: number | undefined = typeof raw === 'number' ? raw : undefined;
  const color = value !== undefined ? (value >= 80 ? "green" : value >= 50 ? "yellow" : "red") : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value !== undefined ? (
        <Badge size="sm" color={color} variant="light">{value.toFixed(1)}%</Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

function WinDeltaCellRenderer(props: any) {
  const { data } = props;
  const value: number | undefined = data.winDelta;
  const color = value !== undefined ? (value > 0.1 ? "green" : value < -0.1 ? "red" : "gray") : undefined;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {value !== undefined ? (
        <Badge size="sm" color={color} variant="light">{(value > 0 ? "+" : "") + value.toFixed(2)}%</Badge>
      ) : (
        <Text size="xs" c="dimmed">-</Text>
      )}
    </div>
  );
}

function AnnotationCellRenderer(props: any) {
  const { data } = props;
  if (!data?.annotation && !data?.isBest && !data?.isOnlyMove && !data?.punishesMistake && !data?.isSacrifice && !data?.isThreat) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">-</Text>
      </div>
    );
  }
  const badges: JSX.Element[] = [];
  if (data.isBest && (data.winChance !== undefined || data.score)) {
    badges.push(<Badge key="best" size="sm" color="blue" variant="light">Best</Badge>);
  }
  if (data.annotation) {
    const info = ANNOTATION_INFO[data.annotation as Annotation];
    badges.push(<Badge key="ann" size="sm" color={info?.color || 'gray'} variant="light">{info?.name || data.annotation}</Badge>);
  }
  if (data.isOnlyMove) badges.push(<Badge key="only" size="sm" color="cyan" variant="light">Only</Badge>);
  if (data.punishesMistake) badges.push(<Badge key="punish" size="sm" color="teal" variant="light">Punish</Badge>);
  if (data.isSacrifice) badges.push(<Badge key="sac" size="sm" color="orange" variant="light">Sac</Badge>);
  if (data.isThreat) badges.push(<Badge key="threat" size="sm" color="grape" variant="light">Threat</Badge>);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {badges}
    </div>
  );
}

function CountCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.total ? <Text size="sm" fw={500}>{data.total.toLocaleString()}</Text> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function PercentageCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.percentage !== undefined ? <Text size="sm">{data.percentage.toFixed(1)}%</Text> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function WinPercentageCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.whitePercentage !== undefined ? <Badge size="sm" color="gray" variant="light">{data.whitePercentage.toFixed(1)}%</Badge> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function DrawPercentageCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.drawPercentage !== undefined ? <Badge size="sm" color="yellow" variant="light">{data.drawPercentage.toFixed(1)}%</Badge> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function LossPercentageCellRenderer(props: any) {
  const { data } = props;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {data.blackPercentage !== undefined ? <Badge size="sm" color="red" variant="light">{data.blackPercentage.toFixed(1)}%</Badge> : <Text size="xs" c="dimmed">-</Text>}
    </div>
  );
}

function MoveLineDisplay({ moves, fen, halfMoves }: { moves: string[]; fen: string; halfMoves: number; }) {
  const [open, setOpen] = useState<boolean>(false);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);
  if (!open) moves = moves.slice(0, 8);
  const [pos] = positionFromFen(fen);
  const moveInfo: any[] = [];
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
    <Flex direction="row" wrap="wrap" style={{ height: open ? '100%' : 35, overflow: 'hidden', alignItems: 'center' }} gap="xs">
      {moveInfo.map(({ san }, index) => {
        const total_moves = halfMoves + index + 1;
        const is_white = total_moves % 2 === 1;
        const move_number = Math.ceil(total_moves / 2);
        return (
          <Box key={index} style={{ display: 'flex', alignItems: 'center' }}>
            {(index === 0 || is_white) && (<Text size="sm" c="dimmed" mr={2}>{`${move_number}${is_white ? '.' : '...'}`}</Text>)}
            <MoveCell move={san} isCurrentVariation={false} annotations={[]} onContextMenu={() => undefined} isStart={false} onClick={() => { const moveSequence = moves.slice(0, index + 1); makeMoves({ payload: moveSequence }); }} />
          </Box>
        );
      })}
      {moves.length > 8 && (
        <ActionIcon size="sm" variant="subtle" onClick={() => setOpen(!open)} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
          <IconChevronDown size={12} />
        </ActionIcon>
      )}
    </Flex>
  );
}

function LineCellRenderer(props: any) {
  const { data } = props;
  const store = useContext(TreeStateContext);
  const currentFen = useStore(store!, (s) => s.currentNode().fen);
  const currentHalfMoves = useStore(store!, (s) => s.currentNode().halfMoves);
  // Prefer row's context if provided, fallback to current selection
  const fen = (data?.contextFen as string) || currentFen;
  const halfMoves = (typeof data?.contextHalfMoves === 'number' ? data.contextHalfMoves : currentHalfMoves) as number;
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
  // debug log removed for performance
  if (!sanMoves || sanMoves.length === 0) {
    return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}><Text size="xs" c="dimmed">-</Text></div>);
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <MoveLineDisplay moves={sanMoves} fen={fen} halfMoves={halfMoves} />
    </div>
  );
}

import type { UnifiedMove } from "@/state/unifiedMoves";
import { playedMovesFamily, type PlayedColor } from "@/state/playedMoves";

function PlayedMovesTable({ color }: { color: PlayedColor }) {
  const activeTab = useAtomValue(activeTabAtom)!;
  const playedMoves = useAtomValue(playedMovesFamily({ tab: activeTab, color }));
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
  const gridOptions: GridOptions<UnifiedMove> = useMemo(() => ({
    theme: darkTheme,
    animateRows: true,
    // Immutable mode helps ag-grid detect row updates with stable getRowId
    immutableData: true,
    suppressScrollOnNewData: true,
    suppressRowVirtualisation: false,
    pagination: false,
    suppressHorizontalScroll: true,
    suppressMovableColumns: false,
    getRowId: (params) => {
      const d: any = params.data as any;
      const idNum = d?.moveNumber ?? "";
      return String(idNum);
    },
    defaultColDef: { sortable: true, resizable: true },
    columnDefs: [
      { headerName: '#', field: 'moveNumber', width: 70, cellRenderer: NumberCellRenderer, pinned: 'left', sortable: true, sort: 'desc', valueGetter: (p: any) => p.data?.moveNumber },
      { headerName: 'Move', field: 'san', width: 120, cellRenderer: CombinedMoveCellRenderer, pinned: 'left', valueGetter: (p: any) => p.data?.san || p.data?.move || '' },
      { headerName: 'Rank', field: 'rank', width: 90, cellRenderer: NumberCellRenderer, sortable: true },
      { headerName: 'Eval Score', field: 'score', width: 100, cellRenderer: ScoreCellRenderer, sortable: true },
      { headerName: 'Annotation', field: 'annotation', width: 160, cellRenderer: AnnotationCellRenderer, sortable: false },
      { headerName: 'PctBest', field: 'pctBest', width: 110, cellRenderer: ConfidenceCellRenderer, sortable: true, cellRendererParams: { type: 'pctBest' } },
      { headerName: 'Confidence', field: 'confidence', width: 120, cellRenderer: ConfidenceCellRenderer, sortable: true },
      { headerName: 'Win Likelihood', field: 'winChance', width: 120, cellRenderer: WinChanceCellRenderer, sortable: true },
      { headerName: 'ΔWin%', field: 'winDelta', width: 90, cellRenderer: WinDeltaCellRenderer, sortable: true },
      { headerName: 'Line', field: 'pv', flex: 1, minWidth: 150, cellRenderer: LineCellRenderer, sortable: false },
      { headerName: '#', field: 'total', width: 80, cellRenderer: CountCellRenderer, sortable: true },
      { headerName: '%', field: 'percentage', width: 80, cellRenderer: PercentageCellRenderer, sortable: true },
      { headerName: '%W', field: 'whitePercentage', width: 100, cellRenderer: WinPercentageCellRenderer, sortable: true },
      { headerName: '%D', field: 'drawPercentage', width: 100, cellRenderer: DrawPercentageCellRenderer, sortable: true },
      { headerName: '%B', field: 'blackPercentage', width: 100, cellRenderer: LossPercentageCellRenderer, sortable: true },
    ],
  }), [darkTheme]);
  return (
    <Stack h="100%" gap="xs" style={{ minHeight: 0 }}>
      <Text size="sm" fw={500}>Played Moves ({playedMoves.length})</Text>
      <div style={{ height: '100%', width: '100%', flex: 1, minHeight: 200 }}>
        <AgGridReact<UnifiedMove>
          rowData={playedMoves}
          gridOptions={gridOptions}
          domLayout="normal"
          suppressHorizontalScroll={true}
          suppressDragLeaveHidesColumns={true}
          suppressScrollOnNewData={true}
          suppressRowVirtualisation={true}
        />
        {/* debug log removed for performance */}
      </div>
    </Stack>
  );
}

export default memo(PlayedMovesTable);


