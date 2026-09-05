import { ActionIcon, Box, Overlay, ScrollArea, Text } from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtomValue } from "jotai";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import Comment from "@/components/common/Comment";
import CompleteMoveCell from "@/components/common/CompleteMoveCell";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { currentShowCommentsAtom, currentShowVariationsAtom, tableViewAtom } from "@/state/atoms";
import {
  filterCollapsedRows,
  findRowIndex,
  flattenNotation,
  flattenTableNotation,
  isMultilineComment,
  type NotationPairRow,
  type NotationRow,
  type TableNotationRow,
} from "@/utils/notationFlatten";
import { formatScore } from "@/utils/score";
import { getNodeAtPath, type TreeNode } from "@/utils/treeReducer";
import styles from "./GameNotation.module.css";

// A single notation row never holds more than this many plies, so even a long unbranched
// mainline is split into several windowed rows instead of one huge row.
const MAX_LINE_PLIES = 40;
const ESTIMATED_ROW_HEIGHT = 28;

type DisplayRow =
  | TableNotationRow
  | { type: "root-comment"; key: string; comment: string }
  | { type: "result"; key: string; result: string };

function PairCell({
  path,
  showComments,
  root,
}: {
  path: number[] | null;
  showComments: boolean;
  root: TreeNode;
}) {
  if (!path) return null;
  const node = getNodeAtPath(root, path);
  return (
    <CompleteMoveCell
      movePath={path}
      halfMoves={node.halfMoves}
      move={node.san}
      fen={node.fen}
      comment={node.comment}
      annotations={node.annotations}
      showComments={showComments}
      tableLayout
      scoreText={showComments && node.score ? formatScore(node.score.value, 1) : undefined}
    />
  );
}

function PairRow({
  row,
  root,
  showComments,
}: {
  row: NotationPairRow;
  root: TreeNode;
  showComments: boolean;
}) {
  return (
    <Box style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr", alignItems: "center" }}>
      <Box className={styles.moveTableMoveNumber}>{row.moveNumber}</Box>
      <Box className={styles.moveTableCell}>
        <PairCell path={row.whitePath} showComments={showComments} root={root} />
      </Box>
      <Box className={styles.moveTableCell}>
        <PairCell path={row.blackPath} showComments={showComments} root={root} />
      </Box>
    </Box>
  );
}

// Re-create the nested variation "swimlanes". Because rows are windowed (there is no wrapping
// container spanning a whole variation), each row paints its full set of ancestor depth guides;
// rows are vertically flush and the vertical padding lives inside the guides, so the left borders
// connect into continuous lanes across consecutive rows.
function Lanes({ depth, children }: { depth: number; children: ReactNode }) {
  let node = children;
  for (let d = 0; d < depth; d++) {
    node = <div className={styles.variationBorder}>{node}</div>;
  }
  return <>{node}</>;
}

function LineRow({
  row,
  root,
  showComments,
  collapsed,
  onToggle,
}: {
  row: Extract<NotationRow, { type: "line" }>;
  root: TreeNode;
  showComments: boolean;
  collapsed: Set<string>;
  onToggle: (branchHead: number[]) => void;
}) {
  const branchHead = row.branchHead;
  const isCollapsed = branchHead ? collapsed.has(branchHead.join(",")) : false;
  return (
    <Box px="sm">
      <Lanes depth={row.depth}>
        <Box pt={4}>
          {branchHead && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              aria-label={isCollapsed ? "Expand variation" : "Collapse variation"}
              onClick={() => onToggle(branchHead)}
              style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}
            >
              {isCollapsed ? <IconPlus size="0.6rem" /> : <IconMinus size="0.6rem" />}
            </ActionIcon>
          )}
          {!isCollapsed &&
            row.paths.map((path, i) => {
              const node = getNodeAtPath(root, path);
              return (
                <CompleteMoveCell
                  key={path.join(",")}
                  movePath={path}
                  halfMoves={node.halfMoves}
                  move={node.san}
                  fen={node.fen}
                  // multi-line comments render as their own row; only inline (single-line) ones stay on the move
                  comment={isMultilineComment(node.comment) ? "" : node.comment}
                  annotations={node.annotations}
                  showComments={showComments}
                  first={i === 0 && row.first}
                />
              );
            })}
        </Box>
      </Lanes>
    </Box>
  );
}

function NotationRowView({
  row,
  root,
  showComments,
  collapsed,
  onToggle,
}: {
  row: DisplayRow;
  root: TreeNode;
  showComments: boolean;
  collapsed: Set<string>;
  onToggle: (branchHead: number[]) => void;
}) {
  if (row.type === "root-comment") {
    return (
      <Box p="sm" fz="sm">
        <Comment comment={row.comment} />
      </Box>
    );
  }
  if (row.type === "result") {
    return (
      <Text ta="center" py="md">
        {row.result}
        <br />
        <Text span fs="italic">
          {row.result === "1/2-1/2" ? "Draw" : row.result === "1-0" ? "White wins" : "Black wins"}
        </Text>
      </Text>
    );
  }
  if (row.type === "comment") {
    return (
      <Box px="sm" fz="sm">
        <Lanes depth={row.depth}>
          <Box pt={4}>
            <Comment comment={row.comment} />
          </Box>
        </Lanes>
      </Box>
    );
  }
  if (row.type === "pair") {
    return <PairRow row={row} root={root} showComments={showComments} />;
  }
  return (
    <LineRow
      row={row}
      root={root}
      showComments={showComments}
      collapsed={collapsed}
      onToggle={onToggle}
    />
  );
}

function VirtualizedNotation({ invisible }: { invisible?: boolean }) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const result = useStore(store, (s) => s.headers.result);
  const showVariations = useAtomValue(currentShowVariationsAtom);
  const showComments = useAtomValue(currentShowCommentsAtom);
  const tableView = useAtomValue(tableViewAtom);
  const colorScheme = useColorScheme();

  // Collapsed variation branch points (path keys). Local state, default all-expanded — matches the
  // old VariationCell toggle, which kept its expanded state in component state too.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const onToggle = (branchHead: number[]) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const key = branchHead.join(",");
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const flattenOpts = { showVariations, showComments, maxLineLength: MAX_LINE_PLIES };
  const moveRows: TableNotationRow[] = tableView
    ? flattenTableNotation(root, flattenOpts)
    : flattenNotation(root, flattenOpts);
  const visibleMoveRows = filterCollapsedRows(moveRows, collapsed);

  const rows: DisplayRow[] = [];
  if (showComments && root.comment) {
    rows.push({ type: "root-comment", key: "root-comment", comment: root.comment });
  }
  const moveRowOffset = rows.length;
  rows.push(...visibleMoveRows);
  if (result && result !== "*") {
    rows.push({ type: "result", key: "result", result });
  }

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 16,
    // Track measured heights by row identity, not index, so toggling comments / variations / table
    // view / collapse (which adds, removes, or resizes rows) never reuses a stale neighbour height.
    getItemKey: (index) => rows[index].key,
  });

  // A toggle can also change a row's height in place (inline comments appear/disappear, a head row
  // collapses to just its +/-), which identity keying alone wouldn't catch — re-measure on those.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    virtualizer.measure();
  }, [showComments, showVariations, tableView, collapsed, virtualizer]);

  // Bring the current move's row into the window when the row changes.
  const moveRowIndex = findRowIndex(visibleMoveRows, position);
  const currentRowIndex = moveRowIndex >= 0 ? moveRowIndex + moveRowOffset : -1;
  useEffect(() => {
    if (currentRowIndex >= 0) {
      virtualizer.scrollToIndex(currentRowIndex, { align: "center" });
    } else {
      virtualizer.scrollToOffset(0);
    }
  }, [currentRowIndex, virtualizer]);

  // Then scroll the exact active move into view: a line row packs up to MAX_LINE_PLIES, so stepping
  // within a row needs cell-level follow. rAF lets a freshly scrolled row mount first; block:
  // "nearest" follows the move without re-centering the row on every step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      parentRef.current?.querySelector("[data-current-move]")?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [position]);

  return (
    <ScrollArea
      flex={1}
      offsetScrollbars
      scrollbars="y"
      viewportRef={parentRef}
      style={{ minHeight: 0 }}
    >
      {invisible && (
        <Overlay
          backgroundOpacity={0.6}
          color={colorScheme === "dark" ? "#1a1b1e" : undefined}
          blur={8}
          zIndex={2}
        />
      )}
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          return (
            <div
              key={row.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
              }}
            >
              <NotationRowView
                row={row}
                root={root}
                showComments={showComments}
                collapsed={collapsed}
                onToggle={onToggle}
              />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default VirtualizedNotation;
