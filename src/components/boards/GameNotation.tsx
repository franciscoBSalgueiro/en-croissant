import { currentInvisibleAtom } from "@/atoms/atoms";
import { Comment } from "@/components/common/Comment";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { isPrefix } from "@/utils/misc";
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
  Text,
  Tooltip,
} from "@mantine/core";
import { shallowEqual, useColorScheme, useToggle } from "@mantine/hooks";
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
import { useAtom, useAtomValue } from "jotai";
import { memo, useContext, useEffect, useRef, useState } from "react";
import CompleteMoveCell from "./CompleteMoveCell";
import OpeningName from "./OpeningName";

function GameNotation({ topBar }: { topBar?: boolean }) {
  const { headers, position, root } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);

  const viewport = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (viewport.current) {
      if (currentNode.fen === INITIAL_FEN) {
        viewport.current.scrollTo({ top: 0, behavior: "smooth" });
      } else if (targetRef.current) {
        viewport.current.scrollTo({
          top: targetRef.current.offsetTop - 65,
          behavior: "smooth",
        });
      }
    }
  }, [currentNode.fen]);

  const invisible = topBar && useAtomValue(currentInvisibleAtom);
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const colorScheme = useColorScheme();

  return (
    <Paper
      withBorder
      p="md"
      flex={1}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Stack h="100%" gap={0}>
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
                  blur={3}
                  zIndex={2}
                />
              )}
              {showComments && root.comment && (
                <Comment comment={root.comment} />
              )}
              <RenderVariationTree
                currentPath={position}
                targetRef={targetRef}
                tree={root}
                depth={0}
                first
                start={headers.start}
                showVariations={showVariations}
                showComments={showComments}
                path={[]}
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
      <Group style={{ justifyContent: "space-between" }}>
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
    tree,
    depth,
    currentPath,
    start,
    first,
    showVariations,
    showComments,
    targetRef,
    path,
  }: {
    currentPath: number[];
    start?: number[];
    tree: TreeNode;
    depth: number;
    first?: boolean;
    showVariations: boolean;
    showComments: boolean;
    targetRef: React.RefObject<HTMLSpanElement>;
    path: number[];
  }) {
    const variations = tree.children;
    const moveNodes = showVariations
      ? variations.slice(1).map((variation) => (
          <>
            <CompleteMoveCell
              targetRef={targetRef}
              annotations={variation.annotations}
              comment={variation.comment}
              halfMoves={variation.halfMoves}
              move={variation.san}
              movePath={[...path, variations.indexOf(variation)]}
              showComments={showComments}
              isCurrentVariation={shallowEqual(
                [...path, variations.indexOf(variation)],
                currentPath,
              )}
              isStart={shallowEqual(
                [...path, variations.indexOf(variation)],
                start,
              )}
              first
            />
            <RenderVariationTree
              currentPath={currentPath}
              targetRef={targetRef}
              tree={variation}
              depth={depth + 2}
              first
              showVariations={showVariations}
              showComments={showComments}
              start={start}
              path={[...path, variations.indexOf(variation)]}
            />
          </>
        ))
      : [];

    return (
      <>
        {variations.length > 0 && (
          <CompleteMoveCell
            targetRef={targetRef}
            annotations={variations[0].annotations}
            comment={variations[0].comment}
            halfMoves={variations[0].halfMoves}
            move={variations[0].san}
            movePath={[...path, 0]}
            showComments={showComments}
            isCurrentVariation={shallowEqual([...path, 0], currentPath)}
            isStart={shallowEqual([...path, 0], start)}
            first={first}
          />
        )}

        <VariationCell moveNodes={moveNodes} />

        {tree.children.length > 0 && (
          <RenderVariationTree
            currentPath={currentPath}
            targetRef={targetRef}
            tree={tree.children[0]}
            depth={depth + 1}
            showVariations={showVariations}
            start={start}
            showComments={showComments}
            path={[...path, 0]}
          />
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      prev.depth === next.depth &&
      prev.first === next.first &&
      prev.showVariations === next.showVariations &&
      prev.showComments === next.showComments &&
      shallowEqual(prev.path, next.path) &&
      next.path.some((v) => v !== 0) && // don't memoize main line
      ((shallowEqual(prev.currentPath, next.currentPath) &&
        !isPrefix(next.path.slice(0, -1), next.currentPath) &&
        shallowEqual(
          getNodeAtPath(next.tree, next.path),
          getNodeAtPath(prev.tree, prev.path),
        )) ||
        (!isPrefix(next.path, next.currentPath) &&
          !isPrefix(next.path, prev.currentPath)))
    );
  },
);

function VariationCell({ moveNodes }: { moveNodes: React.ReactNode[] }) {
  const [expanded, setExpanded] = useState(true);
  if (moveNodes.length >= 1)
    return (
      <>
        <Box
          style={{
            borderLeft: "2px solid #404040",
            paddingLeft: 5,
            marginLeft: 12,
          }}
        >
          <ActionIcon size="xs" onClick={() => setExpanded((v) => !v)}>
            {!expanded ? (
              <IconPlus size="0.5rem" />
            ) : (
              <IconMinus size="0.5rem" />
            )}
          </ActionIcon>
          {expanded &&
            moveNodes.map((node, i) => (
              <Box
                key={i}
                style={{
                  "::before": {
                    display: "inline-block",
                    content: '" "',
                    borderTop: "2px solid #404040",
                    width: 8,
                    height: 5,
                    marginLeft: -5,
                    marginTop: 16,
                  },
                }}
              >
                {node}
              </Box>
            ))}
        </Box>
      </>
    );
  return <></>;
}

export default memo(GameNotation);
