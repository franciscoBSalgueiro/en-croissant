import { Comment } from "@/components/common/Comment";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { currentInvisibleAtom, tableViewAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { formatScore } from "@/utils/score";
import { type TreeNode, getNodeAtPath } from "@/utils/treeReducer";
import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { useColorScheme, useToggle } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconList,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect, useRef, useState } from "react";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import CompleteMoveCell from "./CompleteMoveCell";
import * as styles from "./GameNotation.css";
import OpeningName from "./OpeningName";

function GameNotation({
  topBar,
  controls,
}: { topBar?: boolean; controls?: React.ReactNode }) {
  const store = useContext(TreeStateContext)!;
  const currentFen = useStore(store, (s) => s.currentNode().fen);
  const headers = useStore(store, (s) => s.headers);
  const rootComment = useStore(store, (s) => s.root.comment);

  const viewport = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (viewport.current) {
      if (currentFen === INITIAL_FEN) {
        viewport.current.scrollTo({ top: 0, behavior: "auto" });
      } else if (targetRef.current) {
        const viewportEl = viewport.current;
        const targetEl = targetRef.current;
        const viewportRect = viewportEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const offsetInViewport =
          targetRect.top - viewportRect.top + viewportEl.scrollTop;
        viewportEl.scrollTo({
          top: offsetInViewport - 65,
          behavior: "auto",
        });
      }
    }
  }, [currentFen]);

  const [invisibleValue, setInvisible] = useAtom(currentInvisibleAtom);
  const invisible = topBar && invisibleValue;
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const [tableView, setTableView] = useAtom(tableViewAtom);
  const colorScheme = useColorScheme();

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.TOGGLE_BLUR.keys, () => setInvisible((v) => !v));

  return (
    <Paper
      withBorder
      flex={1}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Group h="100%" wrap="nowrap" align="stretch" gap={0}>
        {controls && (
          <>
            <ScrollArea type="never" py="md" mx="xs" style={{ flexShrink: 0 }}>
              {controls}
            </ScrollArea>
            <Divider orientation="vertical" />
          </>
        )}
        <Stack h="100%" gap={0} style={{ flex: 1, minWidth: 0 }}>
          {topBar && (
            <NotationHeader
              showComments={showComments}
              toggleComments={toggleComments}
              showVariations={showVariations}
              toggleVariations={toggleVariations}
            />
          )}
          <ScrollArea
            flex={1}
            offsetScrollbars
            scrollbars="y"
            viewportRef={viewport}
          >
            <Stack gap="xs">
              <Box>
                {invisible && (
                  <Overlay
                    backgroundOpacity={0.6}
                    color={colorScheme === "dark" ? "#1a1b1e" : undefined}
                    blur={8}
                    zIndex={2}
                  />
                )}
                {showComments && rootComment && (
                  <Comment comment={rootComment} />
                )}
                {tableView ? (
                  <TableNotation
                    targetRef={targetRef}
                    start={headers.start}
                    showVariations={showVariations}
                    showComments={showComments}
                  />
                ) : (
                  <Box pt="md" px="sm">
                    <RenderVariationTree
                      targetRef={targetRef}
                      nodePath={[]}
                      depth={0}
                      first
                      start={headers.start}
                      showVariations={showVariations}
                      showComments={showComments}
                    />
                  </Box>
                )}
              </Box>
              <Box pb="md">
                {headers.result !== "*" && (
                  <Text ta="center">
                    {headers.result}
                    <br />
                    <Text span fs="italic">
                      {headers.result === "1/2-1/2"
                        ? "Draw"
                        : headers.result === "1-0"
                          ? "White wins"
                          : "Black wins"}
                    </Text>
                  </Text>
                )}
              </Box>
            </Stack>
          </ScrollArea>
        </Stack>
      </Group>
    </Paper>
  );
}

const NotationHeader = memo(function NotationHeader({
  showComments,
  toggleComments,
  showVariations,
  toggleVariations,
}: {
  showComments: boolean;
  toggleComments: () => void;
  showVariations: boolean;
  toggleVariations: () => void;
}) {
  const { t } = useTranslation();
  const [invisible, setInvisible] = useAtom(currentInvisibleAtom);
  const [tableView, setTableView] = useAtom(tableViewAtom);
  return (
    <Stack gap="xs" pt="xs">
      <Group justify="space-between" px="sm">
        <OpeningName />
        <Group gap="sm">
          <Tooltip
            label={
              invisible ? t("Notation.ShowMoves") : t("Notation.HideMoves")
            }
          >
            <ActionIcon onClick={() => setInvisible((v) => !v)}>
              {invisible ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              tableView ? t("Notation.NormalView") : t("Notation.TableView")
            }
          >
            <ActionIcon onClick={() => setTableView((v) => !v)}>
              {tableView ? (
                <IconList size="1rem" />
              ) : (
                <IconLayoutList size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              showComments
                ? t("Notation.HideComments")
                : t("Notation.ShowComments")
            }
          >
            <ActionIcon onClick={() => toggleComments()}>
              {showComments ? (
                <IconArticle size="1rem" />
              ) : (
                <IconArticleOff size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              showVariations
                ? t("Notation.HideVariations")
                : t("Notation.ShowVariations")
            }
          >
            <ActionIcon onClick={() => toggleVariations()}>
              {showVariations ? (
                <IconArrowsSplit size="1rem" />
              ) : (
                <IconArrowRight size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Divider />
    </Stack>
  );
});

const RenderVariationTree = memo(
  function RenderVariationTree({
    nodePath,
    depth,
    start,
    first,
    showVariations,
    showComments,
    targetRef,
  }: {
    start?: number[];
    nodePath: number[];
    depth: number;
    first?: boolean;
    showVariations: boolean;
    showComments: boolean;
    targetRef: React.RefObject<HTMLSpanElement>;
  }) {
    const store = useContext(TreeStateContext)!;
    const node = useStore(store, (s) => getNodeAtPath(s.root, nodePath));
    const variations = node.children;

    const variationNodes = showVariations
      ? variations.slice(1).map((variation, idx) => {
          const variationIndex = idx + 1;
          const newPath = [...nodePath, variationIndex];
          return (
            <React.Fragment key={variation.fen}>
              <CompleteMoveCell
                targetRef={targetRef}
                annotations={variation.annotations}
                comment={variation.comment}
                halfMoves={variation.halfMoves}
                move={variation.san}
                fen={variation.fen}
                movePath={newPath}
                showComments={showComments}
                isStart={equal(newPath, start)}
                first
              />
              <RenderVariationTree
                targetRef={targetRef}
                nodePath={newPath}
                depth={depth + 2}
                showVariations={showVariations}
                showComments={showComments}
                start={start}
              />
            </React.Fragment>
          );
        })
      : [];

    const mainLinePath = [...nodePath, 0];
    return (
      <>
        {variations.length > 0 && (
          <CompleteMoveCell
            targetRef={targetRef}
            annotations={variations[0].annotations}
            comment={variations[0].comment}
            halfMoves={variations[0].halfMoves}
            move={variations[0].san}
            fen={variations[0].fen}
            movePath={mainLinePath}
            showComments={showComments}
            isStart={equal(mainLinePath, start)}
            first={first}
          />
        )}

        <VariationCell moveNodes={variationNodes} />

        {node.children.length > 0 && (
          <RenderVariationTree
            targetRef={targetRef}
            nodePath={mainLinePath}
            depth={depth + 1}
            showVariations={showVariations}
            start={start}
            showComments={showComments}
          />
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      equal(prev.nodePath, next.nodePath) &&
      prev.depth === next.depth &&
      prev.first === next.first &&
      prev.showVariations === next.showVariations &&
      prev.showComments === next.showComments &&
      equal(prev.start, next.start)
    );
  },
);

const TableNotation = memo(function TableNotation({
  targetRef,
  start,
  showVariations,
  showComments,
}: {
  targetRef: React.RefObject<HTMLSpanElement>;
  start?: number[];
  showVariations: boolean;
  showComments: boolean;
}) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);

  type RowItem = {
    type: "row";
    moveNumber: number;
    white: TreeNode | null;
    whitePath: number[];
    black: TreeNode | null;
    blackPath: number[];
    splitRow?: boolean;
  };
  type VariationItem = {
    type: "variations";
    variations: TreeNode[];
    parentPath: number[];
  };
  type CommentItem = {
    type: "comment";
    comment: string;
  };
  type Segment = RowItem | VariationItem | CommentItem;

  const segments: Segment[] = [];

  let current = root;
  let path: number[] = [];

  while (current.children.length > 0) {
    const child = current.children[0];
    const childPath = [...path, 0];
    const isWhite = child.halfMoves % 2 === 1;
    const moveNum = Math.ceil(child.halfMoves / 2);
    const whiteVariations = current.children.slice(1);

    if (isWhite) {
      const hasWhiteVars = showVariations && whiteVariations.length > 0;
      const hasWhiteComment = showComments && !!child.comment;

      let blackNode: TreeNode | null = null;
      let blackPath: number[] = [];
      let blackVariations: TreeNode[] = [];

      if (child.children.length > 0) {
        const blackChild = child.children[0];
        const bPath = [...childPath, 0];
        if (blackChild.halfMoves % 2 === 0) {
          blackNode = blackChild;
          blackPath = bPath;
          blackVariations = child.children.slice(1);
        }
      }

      const hasBlackVars = showVariations && blackVariations.length > 0;
      const hasBlackComment = showComments && !!blackNode?.comment;
      const splitWhite = hasWhiteVars || hasWhiteComment;

      if (splitWhite) {
        segments.push({
          type: "row",
          moveNumber: moveNum,
          white: child,
          whitePath: childPath,
          black: null,
          blackPath: [],
          splitRow: !!blackNode,
        });
        if (hasWhiteComment) {
          segments.push({ type: "comment", comment: child.comment });
        }
        if (hasWhiteVars) {
          segments.push({
            type: "variations",
            variations: whiteVariations,
            parentPath: childPath.slice(0, -1),
          });
        }

        if (blackNode) {
          if (hasBlackVars || hasBlackComment) {
            segments.push({
              type: "row",
              moveNumber: moveNum,
              white: null,
              whitePath: [],
              black: blackNode,
              blackPath: blackPath,
            });
            if (hasBlackComment) {
              segments.push({ type: "comment", comment: blackNode.comment });
            }
            if (hasBlackVars) {
              segments.push({
                type: "variations",
                variations: blackVariations,
                parentPath: blackPath.slice(0, -1),
              });
            }
          } else {
            segments.push({
              type: "row",
              moveNumber: moveNum,
              white: null,
              whitePath: [],
              black: blackNode,
              blackPath: blackPath,
            });
          }
          current = blackNode;
          path = blackPath;
        } else {
          current = child;
          path = childPath;
        }
      } else if (hasBlackVars || hasBlackComment) {
        segments.push({
          type: "row",
          moveNumber: moveNum,
          white: child,
          whitePath: childPath,
          black: blackNode,
          blackPath: blackPath,
        });
        if (hasBlackComment) {
          segments.push({ type: "comment", comment: blackNode!.comment });
        }
        if (hasBlackVars) {
          segments.push({
            type: "variations",
            variations: blackVariations,
            parentPath: blackPath.slice(0, -1),
          });
        }
        current = blackNode!;
        path = blackPath;
      } else {
        segments.push({
          type: "row",
          moveNumber: moveNum,
          white: child,
          whitePath: childPath,
          black: blackNode,
          blackPath: blackPath,
        });
        if (blackNode) {
          current = blackNode;
          path = blackPath;
        } else {
          current = child;
          path = childPath;
        }
      }
    } else {
      const hasBlackVars = showVariations && whiteVariations.length > 0;
      const hasBlackComment = showComments && !!child.comment;
      segments.push({
        type: "row",
        moveNumber: moveNum,
        white: null,
        whitePath: [],
        black: child,
        blackPath: childPath,
      });
      if (hasBlackComment) {
        segments.push({ type: "comment", comment: child.comment });
      }
      if (hasBlackVars) {
        segments.push({
          type: "variations",
          variations: whiteVariations,
          parentPath: childPath.slice(0, -1),
        });
      }
      current = child;
      path = childPath;
    }
  }

  return (
    <Table layout="fixed">
      <Table.Tbody>
        {segments.map((seg, idx) => {
          if (seg.type === "comment") {
            return (
              <tr key={`comment-${idx}`}>
                <td colSpan={3}>
                  <Box pl="sm" pt="xs">
                    <Comment comment={seg.comment} />
                  </Box>
                </td>
              </tr>
            );
          }

          if (seg.type === "variations") {
            return (
              <tr key={`var-${idx}`}>
                <td colSpan={3}>
                  <Box pl="sm" pt="xs">
                    {seg.variations.map((variation, vIdx) => {
                      const variationPath = [...seg.parentPath, vIdx + 1];
                      return (
                        <Box
                          key={variation.fen}
                          className={styles.variationBorder}
                          mb={4}
                        >
                          <CompleteMoveCell
                            targetRef={targetRef}
                            annotations={variation.annotations}
                            comment={variation.comment}
                            halfMoves={variation.halfMoves}
                            move={variation.san}
                            fen={variation.fen}
                            movePath={variationPath}
                            showComments={showComments}
                            isStart={equal(variationPath, start)}
                            first
                          />
                          <RenderVariationTree
                            targetRef={targetRef}
                            nodePath={variationPath}
                            depth={1}
                            showVariations={showVariations}
                            showComments={showComments}
                            start={start}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </td>
              </tr>
            );
          }

          const row = seg;
          return (
            <React.Fragment key={`row-${row.moveNumber}-${idx}`}>
              <Table.Tr>
                <Table.Td className={styles.moveTableMoveNumber}>
                  {row.moveNumber}
                </Table.Td>
                <Table.Td className={styles.moveTableCell}>
                  {row.white ? (
                    <CompleteMoveCell
                      targetRef={targetRef}
                      annotations={row.white.annotations}
                      comment={row.white.comment}
                      halfMoves={row.white.halfMoves}
                      move={row.white.san}
                      fen={row.white.fen}
                      movePath={row.whitePath}
                      showComments={showComments}
                      isStart={equal(row.whitePath, start)}
                      tableLayout
                      scoreText={
                        row.white.score
                          ? formatScore(row.white.score.value, 1)
                          : undefined
                      }
                    />
                  ) : (
                    <Text c="dimmed" style={{ padding: "5px 8px" }}>
                      ...
                    </Text>
                  )}
                </Table.Td>
                <Table.Td className={styles.moveTableCell}>
                  {row.black ? (
                    <CompleteMoveCell
                      targetRef={targetRef}
                      annotations={row.black.annotations}
                      comment={row.black.comment}
                      halfMoves={row.black.halfMoves}
                      move={row.black.san}
                      fen={row.black.fen}
                      movePath={row.blackPath}
                      showComments={showComments}
                      isStart={equal(row.blackPath, start)}
                      tableLayout
                      scoreText={
                        row.black.score
                          ? formatScore(row.black.score.value, 1)
                          : undefined
                      }
                    />
                  ) : row.splitRow ? (
                    <Text c="dimmed" style={{ padding: "5px 8px" }}>
                      ...
                    </Text>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            </React.Fragment>
          );
        })}
      </Table.Tbody>
    </Table>
  );
});

function VariationCell({ moveNodes }: { moveNodes: React.ReactNode[] }) {
  const [expanded, setExpanded] = useState(true);
  if (moveNodes.length === 0) return null;
  return (
    <Box className={styles.variationBorder}>
      <ActionIcon size="xs" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <IconMinus size="0.5rem" /> : <IconPlus size="0.5rem" />}
      </ActionIcon>
      {expanded &&
        moveNodes.map((node, i) => (
          <Box key={i} className={styles.lineBeforeVariation}>
            {node}
          </Box>
        ))}
    </Box>
  );
}

export default memo(GameNotation);
