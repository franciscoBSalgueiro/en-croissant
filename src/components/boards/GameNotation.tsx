import {
  ActionIcon,
  Box,
  Button,
  CopyButton,
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
import { useForceUpdate, useToggle } from "@mantine/hooks";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconMinus,
  IconPlug,
  IconPlus,
} from "@tabler/icons";
import { useContext } from "react";
import { Annotation, annotationColor, VariationTree } from "../../utils/chess";
import { Outcome } from "../../utils/db";
import TreeContext from "../common/TreeContext";
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
  setTree,
  topVariation,
  outcome,
}: {
  setTree: (tree: VariationTree) => void;
  topVariation: VariationTree;
  outcome: Outcome;
}) {
  const forceUpdate = useForceUpdate();
  const theme = useMantineTheme();
  const [invisible, toggleVisible] = useToggle();
  const { classes } = useStyles();
  const pgn = topVariation.getPGN();

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      {invisible && (
        <Overlay
          opacity={0.6}
          color={theme.colorScheme === "dark" ? "#222" : undefined}
          blur={3}
          zIndex={2}
        />
      )}
      <ScrollArea style={{ height: "200px" }} offsetScrollbars>
        <Stack>
          <Stack className={classes.scroller}>
            <Group style={{ justifyContent: "space-between" }}>
              <OpeningName />
              <Group spacing="sm">
                <Tooltip label={invisible ? "Show moves" : "Hide moves"}>
                  <ActionIcon onClick={() => toggleVisible()}>
                    {invisible ? (
                      <IconEyeOff size={15} />
                    ) : (
                      <IconEye size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={pgn} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy PGN"} withArrow>
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        onClick={copy}
                      >
                        {copied ? (
                          <IconCheck size={15} />
                        ) : (
                          <IconCopy size={15} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Divider />
          </Stack>
          <Box>
            <RenderVariationTree
              tree={topVariation}
              depth={0}
              first
              setTree={setTree}
              forceUpdate={forceUpdate}
            />
          </Box>
          {outcome !== Outcome.Unknown && (
            <Text align="center">
              {outcome}
              <br />
              <Text span fs="italic">
                {outcome === Outcome.Draw
                  ? "Draw"
                  : outcome === Outcome.WhiteWin
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

function RenderVariationTree({
  tree,
  depth,
  first,
  setTree,
  forceUpdate,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
}) {
  const variations = tree.children;
  const moveNodes = variations.slice(1).map((variation) => (
    <>
      <CompleteMoveCell
        tree={variation}
        setTree={setTree}
        forceUpdate={forceUpdate}
        first
      />
      <RenderVariationTree
        tree={variation}
        depth={depth + 2}
        setTree={setTree}
        first
        forceUpdate={forceUpdate}
      />
    </>
  ));

  return (
    <>
      {variations.length > 0 && (
        <CompleteMoveCell
          tree={variations[0]}
          setTree={setTree}
          forceUpdate={forceUpdate}
          first={first}
        />
      )}

      <VariationCell moveNodes={moveNodes} />

      {tree.children.length > 0 && (
        <RenderVariationTree
          tree={tree.children[0]}
          depth={depth + 1}
          setTree={setTree}
          forceUpdate={forceUpdate}
        />
      )}
    </>
  );
}

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
      <>
        {"("}
        {moveNodes}
        {")"}
      </>
    );
  else return <></>;
}

const useMoveStyles = createStyles(
  (
    theme,
    {
      isCurrentVariation,
      color,
    }: { isCurrentVariation: boolean; color: string }
  ) => ({
    cell: {
      all: "unset",
      fontSize: 14,
      fontWeight: 600,
      display: "inline-block",
      padding: 6,
      borderRadius: 4,
      cursor: "pointer",
      color:
        color === "gray"
          ? theme.colorScheme === "dark"
            ? theme.white
            : theme.colors.gray[8]
          : theme.colors[color][6],
      backgroundColor: isCurrentVariation
        ? theme.fn.rgba(theme.colors[color][6], 0.2)
        : "transparent",
      "&:hover": {
        backgroundColor: theme.fn.rgba(
          theme.colors[color][6],
          isCurrentVariation ? 0.25 : 0.1
        ),
      },
    },
  })
);

function CompleteMoveCell({
  tree,
  setTree,
  forceUpdate,
  first,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
  first?: boolean;
}) {
  const move_number = Math.ceil(tree.half_moves / 2);
  const is_white = tree.half_moves % 2 === 1;
  const hasNumber = tree.half_moves > 0 && (first || is_white);
  const lastMove = tree.move;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        marginLeft: hasNumber ? 6 : 0,
        fontSize: 14,
      }}
    >
      {hasNumber && <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>}
      {lastMove && (
        <MoveCell
          move={lastMove.san}
          variation={tree}
          setTree={setTree}
          annotation={tree.annotation}
          comment={tree.commentHTML}
          forceUpdate={forceUpdate}
        />
      )}
    </Box>
  );
}

function MoveCell({
  move,
  variation,
  annotation,
  comment,
  setTree,
  forceUpdate,
}: {
  move: string;
  variation: VariationTree;
  annotation: Annotation;
  comment: string;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
}) {
  const tree = useContext(TreeContext);
  const isCurrentVariation = variation.equals(tree);
  const color = annotationColor(annotation);
  const multipleLine =
    comment.split("</p>").length - 1 > 1 ||
    comment.includes("<blockquote>") ||
    comment.includes("<ul>") ||
    comment.includes("<h");

  function promoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        variation,
        ...parent.children.filter((child) => child !== variation),
      ];
      if (isCurrent) {
        forceUpdate();
      } else {
        setTree(variation);
      }
    }
  }

  function demoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        ...parent.children.filter((child) => child !== variation),
        variation,
      ];
      if (isCurrent) {
        forceUpdate();
      } else {
        setTree(variation);
      }
    }
  }

  function deleteVariation(variation: VariationTree) {
    const isInCurrentBranch = tree.isInBranch(variation);
    const parent = variation.parent;
    if (parent) {
      parent.children = parent.children.filter((child) => child !== variation);
      if (isInCurrentBranch) {
        setTree(parent);
      } else {
        forceUpdate();
      }
    }
  }

  const { classes } = useMoveStyles({ isCurrentVariation, color });

  return (
    <>
      <Box
        component="button"
        className={classes.cell}
        onClick={() => {
          setTree(variation);
        }}
      >
        {move + annotation}
      </Box>
      {comment && (
        <TypographyStylesProvider
          style={{
            display: multipleLine ? "block" : "inline-block",
            marginLeft: 4,
            marginRight: 4,
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: comment,
            }}
          />
        </TypographyStylesProvider>
      )}
    </>
  );
}

export default GameNotation;
