import {
  ActionIcon,
  Box,
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
import { useToggle } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArrowUp,
  IconArticle,
  IconArticleOff,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconMinus,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { memo, useContext } from "react";
import { VariationTree } from "../../utils/chess";
import { NormalizedGame, Outcome } from "../../utils/db";
import GameContext from "../common/GameContext";
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
  game,
  setTree,
  topVariation,
  result,
  boardSize,
  deleteVariation,
  promoteVariation,
}: {
  game: NormalizedGame;
  setTree: (tree: VariationTree) => void;
  topVariation: VariationTree;
  deleteVariation?: () => void;
  promoteVariation?: () => void;
  result?: string;
  boardSize: number;
}) {
  const theme = useMantineTheme();
  const [invisible, toggleVisible] = useToggle();
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const { classes } = useStyles();
  const pgn = topVariation.getPGN({ headers: game });

  const multipleLine =
    topVariation.commentHTML.split("</p>").length - 1 > 1 ||
    topVariation.commentHTML.includes("<blockquote>") ||
    topVariation.commentHTML.includes("<ul>") ||
    topVariation.commentHTML.includes("<h");

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      <ScrollArea sx={{ height: boardSize / 3 }} offsetScrollbars>
        <Stack>
          <Stack className={classes.scroller}>
            <Group style={{ justifyContent: "space-between" }}>
              <OpeningName />
              <Group spacing="sm">
                {deleteVariation && (
                  <Tooltip label="Delete variation">
                    <ActionIcon onClick={() => deleteVariation()}>
                      <IconX size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {promoteVariation && (
                  <Tooltip label="Promote variation">
                    <ActionIcon onClick={() => promoteVariation()}>
                      <IconArrowUp size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={invisible ? "Show moves" : "Hide moves"}>
                  <ActionIcon onClick={() => toggleVisible()}>
                    {invisible ? (
                      <IconEyeOff size={15} />
                    ) : (
                      <IconEye size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={showComments ? "Hide comments" : "Show comments"}
                >
                  <ActionIcon onClick={() => toggleComments()}>
                    {showComments ? (
                      <IconArticle size={15} />
                    ) : (
                      <IconArticleOff size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={showVariations ? "Show Variations" : "Main line"}
                >
                  <ActionIcon onClick={() => toggleVariations()}>
                    {showVariations ? (
                      <IconArrowsSplit size={15} />
                    ) : (
                      <IconArrowRight size={15} />
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
            {invisible && (
              <Overlay
                opacity={0.6}
                color={theme.colorScheme === "dark" ? "#222" : undefined}
                blur={3}
                zIndex={2}
              />
            )}
            {showComments && topVariation.commentHTML && (
              <TypographyStylesProvider
                style={{
                  display: multipleLine ? "block" : "inline-block",
                  marginLeft: 4,
                  marginRight: 4,
                }}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: topVariation.commentHTML,
                  }}
                />
              </TypographyStylesProvider>
            )}
            <RenderVariationTree
              tree={topVariation}
              depth={0}
              first
              setTree={setTree}
              showVariations={showVariations}
              showComments={showComments}
            />
          </Box>
          {result && result !== Outcome.Unknown && (
            <Text align="center">
              {result}
              <br />
              <Text span fs="italic">
                {result === Outcome.Draw
                  ? "Draw"
                  : result === Outcome.WhiteWin
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
  showVariations,
  showComments,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
  showVariations: boolean;
  showComments: boolean;
}) {
  const currentTree = useContext(GameContext).game.tree;
  const variations = tree.children;
  const moveNodes = showVariations
    ? variations.slice(1).map((variation) => (
        <>
          <CompleteMoveCell
            tree={variation}
            setTree={setTree}
            showComments={showComments}
            isCurrentVariation={variation === currentTree}
            first
          />
          <RenderVariationTree
            tree={variation}
            depth={depth + 2}
            setTree={setTree}
            first
            showVariations={showVariations}
            showComments={showComments}
          />
        </>
      ))
    : [];

  return (
    <>
      {variations.length > 0 && (
        <CompleteMoveCell
          tree={variations[0]}
          setTree={setTree}
          showComments={showComments}
          isCurrentVariation={variations[0] === currentTree}
          first={first}
        />
      )}

      <VariationCell moveNodes={moveNodes} />

      {tree.children.length > 0 && (
        <RenderVariationTree
          tree={tree.children[0]}
          depth={depth + 1}
          setTree={setTree}
          showVariations={showVariations}
          showComments={showComments}
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
