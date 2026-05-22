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
import { useColorScheme } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconList,
  IconListTree,
  IconMinus,
  IconPlus,
  IconPointFilled,
} from "@tabler/icons-react";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import React, { memo, useContext, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import Comment from "@/components/common/Comment";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentInvisibleAtom,
  currentRepertoirePrioritizeAtom,
  currentShowCommentsAtom,
  currentShowVariationsAtom,
  viewModeAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { formatScore } from "@/utils/score";
import { getNodeAtPath, type TreeNode } from "@/utils/treeReducer";
import CompleteMoveCell from "./CompleteMoveCell";
import styles from "./GameNotation.module.css";
import OpeningName from "./OpeningName";

function hasMultipleChildrenInChain(node: TreeNode): boolean {
  if (!node.children) return false;
  if (node.children.length > 1) return true;
  if (node.children.length === 1) {
    return hasMultipleChildrenInChain(node.children[0]);
  }
  return false;
}

function hasMultipleChildrenUntilPosition(node: TreeNode, remainingPath: number[]): boolean {
  if (remainingPath.length === 0) return false;
  if (!node.children) return false;
  if (node.children.length > 1) return true;
  const nextNode = node.children[remainingPath[0]];
  if (!nextNode) return false;
  return hasMultipleChildrenUntilPosition(nextNode, remainingPath.slice(1));
}

function GameNotation({ topBar, controls }: { topBar?: boolean; controls?: React.ReactNode }) {
  const store = useContext(TreeStateContext)!;
  const currentFen = useStore(store, (s) => s.currentNode().fen);
  const copyPgn = useStore(store, (s) => s.copyPgn);
  const headers = useStore(store, (s) => s.headers);
  const root = useStore(store, (s) => s.root);
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
        const offsetInViewport = targetRect.top - viewportRect.top + viewportEl.scrollTop;
        viewportEl.scrollTo({
          top: offsetInViewport - 65,
          behavior: "auto",
        });
      }
    }
  }, [currentFen]);

  const [invisibleValue, setInvisible] = useAtom(currentInvisibleAtom);
  const invisible = topBar && invisibleValue;
  const showComments = useAtomValue(currentShowCommentsAtom);
  const viewMode = useAtomValue(viewModeAtom);
  const repertoirePrioritize = useAtomValue(currentRepertoirePrioritizeAtom);
  const colorScheme = useColorScheme();

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.TOGGLE_BLUR.keys, () => setInvisible((v) => !v));
  useHotkeys(keyMap.COPY_PGN.keys, () => copyPgn());

  return (
    <Paper withBorder flex={1} style={{ position: "relative", overflow: "hidden" }}>
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
          {topBar && <NotationHeader />}
          <ScrollArea flex={1} offsetScrollbars scrollbars="y" viewportRef={viewport}>
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
                  <Box p="sm" fz="sm">
                    <Comment comment={rootComment} />
                  </Box>
                )}
                {viewMode === "repertoire" ? (
                  <Box pt="md" px="sm">
                    <RenderRepertoire
                      tree={root}
                      depth={0}
                      path={[]}
                      start={headers.start}
                      showComments={showComments}
                      nextLevelExpanded={true}
                      targetRef={targetRef}
                      prioritizeMainline={repertoirePrioritize}
                    />
                  </Box>
                ) : viewMode === "table" ? (
                  <TableNotation targetRef={targetRef} />
                ) : (
                  <Box pt="md" px="sm">
                    <RenderVariationTree targetRef={targetRef} nodePath={[]} depth={0} first />
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

function NotationHeader() {
  const { t } = useTranslation();
  const [invisible, setInvisible] = useAtom(currentInvisibleAtom);
  const [showComments, setShowComments] = useAtom(currentShowCommentsAtom);
  const [showVariations, setShowVariations] = useAtom(currentShowVariationsAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [repertoirePrioritize, setRepertoirePrioritize] = useAtom(
    currentRepertoirePrioritizeAtom,
  );

  const cycleViewMode = () => {
    if (viewMode === "normal") setViewMode("table");
    else if (viewMode === "table") setViewMode("repertoire");
    else setViewMode("normal");
  };

  return (
    <Stack gap="xs" pt="xs">
      <Group justify="space-between" px="sm">
        <OpeningName />
        <Group gap="sm">
          <Tooltip label={invisible ? t("Notation.MovesHidden") : t("Notation.MovesVisible")}>
            <ActionIcon onClick={() => setInvisible((v) => !v)}>
              {invisible ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={
              viewMode === "normal"
                ? t("Notation.NormalView")
                : viewMode === "table"
                  ? t("Notation.TableView")
                  : t("Notation.RepertoireView")
            }
          >
            <ActionIcon onClick={cycleViewMode}>
              {viewMode === "normal" ? (
                <IconList size="1rem" />
              ) : viewMode === "table" ? (
                <IconLayoutList size="1rem" />
              ) : (
                <IconListTree size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showComments ? t("Notation.CommentsVisible") : t("Notation.CommentsHidden")}>
            <ActionIcon onClick={() => setShowComments((v) => !v)}>
              {showComments ? <IconArticle size="1rem" /> : <IconArticleOff size="1rem" />}
            </ActionIcon>
          </Tooltip>
          {viewMode === "repertoire" ? (
            <Tooltip
              label={
                repertoirePrioritize
                  ? t("Notation.FlatView")
                  : t("Notation.PrioritizeMainline")
              }
            >
              <ActionIcon onClick={() => setRepertoirePrioritize((v) => !v)}>
                {repertoirePrioritize ? (
                  <IconArrowsSplit size="1rem" />
                ) : (
                  <IconListTree size="1rem" />
                )}
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip
              label={
                showVariations
                  ? t("Notation.VariationsVisible")
                  : t("Notation.VariationsHidden")
              }
            >
              <ActionIcon onClick={() => setShowVariations((v) => !v)}>
                {showVariations ? (
                  <IconArrowsSplit size="1rem" />
                ) : (
                  <IconArrowRight size="1rem" />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <Divider />
    </Stack>
  );
}

const RenderVariationTree = memo(
  function RenderVariationTree({
    nodePath,
    depth,
    first,
    targetRef,
  }: {
    nodePath: number[];
    depth: number;
    first?: boolean;
    targetRef: React.RefObject<HTMLSpanElement | null>;
  }) {
    const store = useContext(TreeStateContext)!;
    const showVariations = useAtomValue(currentShowVariationsAtom);
    const showComments = useAtomValue(currentShowCommentsAtom);
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
                first
              />
              <RenderVariationTree targetRef={targetRef} nodePath={newPath} depth={depth + 2} />
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
            first={first}
          />
        )}

        <VariationCell moveNodes={variationNodes} />

        {node.children.length > 0 && (
          <RenderVariationTree targetRef={targetRef} nodePath={mainLinePath} depth={depth + 1} />
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      equal(prev.nodePath, next.nodePath) && prev.depth === next.depth && prev.first === next.first
    );
  },
);

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

const TableNotation = memo(function TableNotation({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const store = useContext(TreeStateContext)!;
  const showVariations = useAtomValue(currentShowVariationsAtom);
  const showComments = useAtomValue(currentShowCommentsAtom);
  const root = useStore(store, (s) => s.root);

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
                        <Box key={variation.fen} className={styles.variationBorder} mb={4}>
                          <CompleteMoveCell
                            targetRef={targetRef}
                            annotations={variation.annotations}
                            comment={variation.comment}
                            halfMoves={variation.halfMoves}
                            move={variation.san}
                            fen={variation.fen}
                            movePath={variationPath}
                            showComments={showComments}
                            first
                          />
                          <RenderVariationTree
                            targetRef={targetRef}
                            nodePath={variationPath}
                            depth={1}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </td>
              </tr>
            );
          }

          return (
            <RowSegment
              key={`row-${idx}`}
              targetRef={targetRef}
              moveNumber={seg.moveNumber}
              whitePathStr={seg.whitePath.join(",")}
              blackPathStr={seg.blackPath.join(",")}
            />
          );
        })}
      </Table.Tbody>
    </Table>
  );
});

function RowSegment({
  moveNumber,
  whitePathStr,
  blackPathStr,
  splitRow,
  targetRef,
}: {
  moveNumber: number;
  whitePathStr: string;
  blackPathStr: string;
  splitRow?: boolean;
  targetRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const store = useContext(TreeStateContext)!;
  const showComments = useAtomValue(currentShowCommentsAtom);
  const whitePath = whitePathStr ? whitePathStr.split(",").map(Number) : [];
  const white = useStore(store, (s) => s.getNode(whitePath));
  const blackPath = blackPathStr ? blackPathStr.split(",").map(Number) : [];
  const black = useStore(store, (s) => s.getNode(blackPath));
  return (
    <Table.Tr>
      <Table.Td className={styles.moveTableMoveNumber}>{moveNumber}</Table.Td>
      <Table.Td className={styles.moveTableCell}>
        {white ? (
          <CompleteMoveCell
            targetRef={targetRef}
            annotations={white.annotations}
            comment={white.comment}
            halfMoves={white.halfMoves}
            move={white.san}
            fen={white.fen}
            movePath={whitePath}
            showComments={showComments}
            tableLayout
            scoreText={showComments && white.score ? formatScore(white.score.value, 1) : undefined}
          />
        ) : (
          <Text c="dimmed" style={{ padding: "5px 8px" }}>
            ...
          </Text>
        )}
      </Table.Td>
      <Table.Td className={styles.moveTableCell}>
        {black ? (
          <CompleteMoveCell
            targetRef={targetRef}
            annotations={black.annotations}
            comment={black.comment}
            halfMoves={black.halfMoves}
            move={black.san}
            fen={black.fen}
            movePath={blackPath}
            showComments={showComments}
            tableLayout
            scoreText={showComments && black.score ? formatScore(black.score.value, 1) : undefined}
          />
        ) : splitRow ? (
          <Text c="dimmed" style={{ padding: "5px 8px" }}>
            ...
          </Text>
        ) : null}
      </Table.Td>
    </Table.Tr>
  );
}

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

function RenderRepertoire({
  tree,
  depth,
  path,
  start,
  first,
  showComments,
  nextLevelExpanded,
  targetRef,
  prioritizeMainline,
}: {
  tree: TreeNode;
  depth: number;
  start?: number[];
  path: number[];
  first?: boolean;
  showComments: boolean;
  nextLevelExpanded?: boolean;
  targetRef: React.RefObject<HTMLSpanElement | null>;
  prioritizeMainline: boolean;
}) {
  const variations = tree.children;
  if (!variations?.length) return null;

  if (depth > 0 && variations.length === 1) {
    const newPath = [...path, 0];
    return (
      <>
        <CompleteMoveCell
          targetRef={targetRef}
          annotations={variations[0].annotations}
          comment={variations[0].comment}
          halfMoves={variations[0].halfMoves}
          move={variations[0].san}
          fen={variations[0].fen}
          movePath={newPath}
          showComments={showComments}
          first={first}
        />
        <RenderRepertoire
          tree={variations[0]}
          depth={depth}
          start={start}
          showComments={showComments}
          path={newPath}
          nextLevelExpanded={nextLevelExpanded}
          targetRef={targetRef}
          prioritizeMainline={prioritizeMainline}
        />
      </>
    );
  }

  if (prioritizeMainline) {
    const mainPath = [...path, 0];
    return (
      <>
        {variations.length > 0 && (
          <>
            <CompleteMoveCell
              targetRef={targetRef}
              annotations={variations[0].annotations}
              comment={variations[0].comment}
              halfMoves={variations[0].halfMoves}
              move={variations[0].san}
              fen={variations[0].fen}
              movePath={mainPath}
              showComments={showComments}
              first={first}
            />
            <RenderRepertoire
              tree={variations[0]}
              depth={depth + 1}
              start={start}
              showComments={showComments}
              path={mainPath}
              nextLevelExpanded={nextLevelExpanded}
              targetRef={targetRef}
              prioritizeMainline={prioritizeMainline}
            />
          </>
        )}
        {variations.slice(1).map((variation, index) => (
          <RepertoireCell
            key={variation.fen}
            variation={variation}
            path={[...path, index + 1]}
            depth={depth + 1}
            start={start}
            showComments={showComments}
            nextLevelExpanded={nextLevelExpanded}
            targetRef={targetRef}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {variations.map((variation, index) => (
        <RepertoireCell
          key={variation.fen}
          variation={variation}
          path={[...path, index]}
          depth={depth + 1}
          start={start}
          showComments={showComments}
          nextLevelExpanded={nextLevelExpanded}
          targetRef={targetRef}
        />
      ))}
    </>
  );
}

function RepertoireCell({
  variation,
  path,
  depth,
  start,
  showComments,
  nextLevelExpanded,
  targetRef,
}: {
  variation: TreeNode;
  path: number[];
  depth: number;
  start?: number[];
  showComments: boolean;
  nextLevelExpanded?: boolean;
  targetRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const store = useContext(TreeStateContext);
  if (!store) {
    throw new Error("RepertoireCell must be used within a TreeStateProvider");
  }
  const position = useStore(store, (s) => s.position);
  const prioritizeMainline = useAtomValue(currentRepertoirePrioritizeAtom);

  const isOnPath = path.every((value, i) => position[i] === value);
  const isPositionDeeper = position.length > path.length;
  const remainingPath = position.slice(path.length);
  const isInCurrentPath =
    isPositionDeeper &&
    isOnPath &&
    hasMultipleChildrenUntilPosition(variation, remainingPath);

  const [expanded, setExpanded] = useState(() => isInCurrentPath);
  const [chevronClicked, setChevronClicked] = useState(false);

  if (depth > 1 && !nextLevelExpanded) {
    return null;
  }

  return (
    <Box className={depth === 1 ? undefined : styles.variationBorder}>
      {hasMultipleChildrenInChain(variation) ? (
        expanded ? (
          isInCurrentPath ? (
            <span style={{ width: "0.6rem", display: "inline-block" }} />
          ) : (
            <IconChevronDown
              size="0.6rem"
              style={{
                opacity: chevronClicked ? 1 : 0,
                transition: "opacity 0.4s",
                cursor: "pointer",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(event) => {
                setChevronClicked(false);
                event.currentTarget.style.opacity = "0";
              }}
              onClick={() => setExpanded(false)}
            />
          )
        ) : (
          <IconChevronRight
            size="0.6rem"
            style={{
              cursor: "pointer",
            }}
            onClick={() => {
              setChevronClicked(true);
              setExpanded(true);
            }}
          />
        )
      ) : (
        <span style={{ width: "0.6rem", display: "inline-block" }} />
      )}
      <IconPointFilled size="0.6rem" />
      <CompleteMoveCell
        annotations={variation.annotations}
        comment={variation.comment}
        halfMoves={variation.halfMoves}
        move={variation.san}
        fen={variation.fen}
        movePath={path}
        showComments={showComments}
        first={true}
        targetRef={targetRef}
      />
      <RenderRepertoire
        tree={variation}
        depth={depth}
        path={path}
        start={start}
        showComments={showComments}
        nextLevelExpanded={expanded}
        targetRef={targetRef}
        prioritizeMainline={prioritizeMainline}
      />
    </Box>
  );
}

export default memo(GameNotation);
