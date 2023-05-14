import {
  ActionIcon,
  Box,
  createStyles,
  Divider,
  Group,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  TypographyStylesProvider,
  useMantineTheme,
} from "@mantine/core";
import { shallowEqual, useToggle } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconEye,
  IconEyeOff,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { DEFAULT_POSITION } from "chess.js";
import { memo, useContext, useEffect, useRef } from "react";
import { Outcome } from "../../utils/db";
import { isPrefix } from "../../utils/misc";
import { getNodeAtPath, TreeNode } from "../../utils/treeReducer";
import { TreeStateContext } from "../common/TreeStateContext";
import CompleteMoveCell from "./CompleteMoveCell";
import OpeningName from "./OpeningName";

const useStyles = createStyles((theme) => ({
  scroller: {
    position: "sticky",
    top: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    zIndex: 10,
  },
}));

function GameNotation({
  boardSize,
  setNotationExpanded,
  notationExpanded,
}: {
  boardSize: number;
  setNotationExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  notationExpanded: boolean;
}) {
  const { headers, position, root } = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(root, position);
  if (!currentNode) {
    return <></>;
  }
  const viewport = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (viewport.current) {
      if (currentNode.fen === DEFAULT_POSITION) {
        viewport.current.scrollTo({ top: 0, behavior: "smooth" });
      } else if (targetRef.current) {
        viewport.current.scrollTo({
          top: targetRef.current.offsetTop - 65,
          behavior: "smooth",
        });
      }
    }
  }, [currentNode.fen]);

  const theme = useMantineTheme();
  const [invisible, toggleVisible] = useToggle();
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const { classes } = useStyles();

  const multipleLine =
    root.commentHTML.split("</p>").length - 1 > 1 ||
    root.commentHTML.includes("<blockquote>") ||
    root.commentHTML.includes("<ul>") ||
    root.commentHTML.includes("<h");

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      <ScrollArea
        sx={{ height: boardSize / 3 }}
        offsetScrollbars
        viewportRef={viewport}
      >
        <Stack>
          <NotationHeader
            setNotationExpanded={setNotationExpanded}
            notationExpanded={notationExpanded}
            invisible={invisible}
            toggleVisible={toggleVisible}
            showComments={showComments}
            toggleComments={toggleComments}
            showVariations={showVariations}
            toggleVariations={toggleVariations}
          />
          <Box>
            {invisible && (
              <Overlay
                opacity={0.6}
                color={theme.colorScheme === "dark" ? "#222" : undefined}
                blur={3}
                zIndex={2}
              />
            )}
            {showComments && root.commentHTML && (
              <TypographyStylesProvider
                style={{
                  display: multipleLine ? "block" : "inline-block",
                  marginLeft: 4,
                  marginRight: 4,
                }}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: root.commentHTML,
                  }}
                />
              </TypographyStylesProvider>
            )}
            <RenderVariationTree
              currentPath={position}
              targetRef={targetRef}
              tree={root}
              depth={0}
              first
              showVariations={showVariations}
              showComments={showComments}
              path={[]}
            />
          </Box>
          {headers.result && headers.result !== Outcome.Unknown && (
            <Text align="center">
              {headers.result}
              <br />
              <Text span fs="italic">
                {headers.result === Outcome.Draw
                  ? "Draw"
                  : headers.result === Outcome.WhiteWin
                    ? "White wins"
                    : "Black wins"}
              </Text>
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

const NotationHeader = memo(
  ({
    setNotationExpanded,
    notationExpanded,
    invisible,
    toggleVisible,
    showComments,
    toggleComments,
    showVariations,
    toggleVariations,
  }: {
    setNotationExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    notationExpanded: boolean;
    invisible: boolean;
    toggleVisible: () => void;
    showComments: boolean;
    toggleComments: () => void;
    showVariations: boolean;
    toggleVariations: () => void;
  }) => {
    const { classes } = useStyles();
    return (
      <Stack className={classes.scroller}>
        <Group style={{ justifyContent: "space-between" }}>
          <OpeningName />
          <Group spacing="sm">
            <ActionIcon onClick={() => setNotationExpanded((v) => !v)}>
              {notationExpanded ? (
                <IconArrowsDiagonalMinimize2 size={15} />
              ) : (
                <IconArrowsDiagonal size={15} />
              )}
            </ActionIcon>
            <Tooltip label={invisible ? "Show moves" : "Hide moves"}>
              <ActionIcon onClick={() => toggleVisible()}>
                {invisible ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={showComments ? "Hide comments" : "Show comments"}>
              <ActionIcon onClick={() => toggleComments()}>
                {showComments ? (
                  <IconArticle size={15} />
                ) : (
                  <IconArticleOff size={15} />
                )}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={showVariations ? "Show Variations" : "Main line"}>
              <ActionIcon onClick={() => toggleVariations()}>
                {showVariations ? (
                  <IconArrowsSplit size={15} />
                ) : (
                  <IconArrowRight size={15} />
                )}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Divider />
      </Stack>
    );
  }
);

const RenderVariationTree = memo(
  ({
    tree,
    depth,
    currentPath,
    first,
    showVariations,
    showComments,
    targetRef,
    path,
  }: {
    currentPath: number[];
    tree: TreeNode;
    depth: number;
    first?: boolean;
    showVariations: boolean;
    showComments: boolean;
    targetRef: React.RefObject<HTMLSpanElement>;
    path: number[];
  }) => {
    const variations = tree.children;
    const moveNodes = showVariations
      ? variations.slice(1).map((variation) => (
        <>
          <CompleteMoveCell
            targetRef={targetRef}
            annotation={variation.annotation}
            commentHTML={variation.commentHTML}
            halfMoves={variation.halfMoves}
            move={variation.move?.san}
            movePath={[...path, variations.indexOf(variation)]}
            showComments={showComments}
            isCurrentVariation={shallowEqual(
              [...path, variations.indexOf(variation)],
              currentPath
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
            annotation={variations[0].annotation}
            commentHTML={variations[0].commentHTML}
            halfMoves={variations[0].halfMoves}
            move={variations[0].move?.san}
            movePath={[...path, 0]}
            showComments={showComments}
            isCurrentVariation={shallowEqual([...path, 0], currentPath)}
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
          getNodeAtPath(prev.tree, prev.path)
        )) ||
        (!isPrefix(next.path, next.currentPath) &&
          !isPrefix(next.path, prev.currentPath)))
    );
  }
);

function VariationCell({ moveNodes }: { moveNodes: React.ReactNode[] }) {
  const [invisible, toggleVisible] = useToggle();
  if (moveNodes.length > 1)
    return (
      <>
        <Box
          sx={{
            borderLeft: "2px solid #404040",
            paddingLeft: 5,
            marginLeft: 12,
          }}
        >
          <ActionIcon size="xs" onClick={() => toggleVisible()}>
            {invisible ? <IconPlus size={8} /> : <IconMinus size={8} />}
          </ActionIcon>
          {!invisible &&
            moveNodes.map((node, i) => (
              <Box
                key={i}
                sx={{
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
  else if (moveNodes.length === 1)
    return (
      <Box sx={{ fontStyle: "italic" }}>
        {"("}
        {moveNodes.map((node, i) => (
          <span key={i}>{node}</span>
        ))}
        {")"}
      </Box>
    );
  else return <></>;
}

export default memo(GameNotation);
