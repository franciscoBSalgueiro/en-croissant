import { Comment } from "@/components/common/Comment";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { currentInvisibleAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { getNodeAtPath } from "@/utils/treeReducer";
import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
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
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect, useRef, useState } from "react";
import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
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
        viewport.current.scrollTo({ top: 0, behavior: "smooth" });
      } else if (targetRef.current) {
        viewport.current.scrollTo({
          top: targetRef.current.offsetTop - 65,
          behavior: "smooth",
        });
      }
    }
  }, [currentFen]);

  const [invisibleValue, setInvisible] = useAtom(currentInvisibleAtom);
  const invisible = topBar && invisibleValue;
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const colorScheme = useColorScheme();

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.TOGGLE_BLUR.keys, () => setInvisible((v) => !v));

  return (
    <Paper
      withBorder
      p="md"
      flex={1}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Group h="100%" gap="xs" wrap="nowrap" align="stretch">
        {controls && (
          <ScrollArea type="never" style={{ flexShrink: 0 }}>
            {controls}
          </ScrollArea>
        )}
        <Divider orientation="vertical" />
        <Stack h="100%" gap={0} style={{ flex: 1, minWidth: 0 }}>
          {topBar && (
            <NotationHeader
              showComments={showComments}
              toggleComments={toggleComments}
              showVariations={showVariations}
              toggleVariations={toggleVariations}
            />
          )}
          <ScrollArea flex={1} offsetScrollbars viewportRef={viewport}>
            <Stack pt="md">
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
              {headers.result && headers.result !== "*" && (
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
  const [invisible, setInvisible] = useAtom(currentInvisibleAtom);
  return (
    <Stack>
      <Group justify="space-between">
        <OpeningName />
        <Group gap="sm">
          <Tooltip label={invisible ? "Show moves" : "Hide moves"}>
            <ActionIcon onClick={() => setInvisible((v) => !v)}>
              {invisible ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showComments ? "Hide comments" : "Show comments"}>
            <ActionIcon onClick={() => toggleComments()}>
              {showComments ? (
                <IconArticle size="1rem" />
              ) : (
                <IconArticleOff size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showVariations ? "Show Variations" : "Main line"}>
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
