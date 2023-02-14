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
  useMantineTheme
} from "@mantine/core";
import { useForceUpdate, useToggle } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconMinus,
  IconPlus
} from "@tabler/icons";
import { VariationTree } from "../../utils/chess";
import { Outcome } from "../../utils/db";
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
  setTree,
  topVariation,
  outcome,
  boardSize,
}: {
  setTree: (tree: VariationTree) => void;
  topVariation: VariationTree;
  outcome: Outcome;
  boardSize: number;
}) {
  const forceUpdate = useForceUpdate();
  const theme = useMantineTheme();
  const [invisible, toggleVisible] = useToggle();
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const { classes } = useStyles();
  const pgn = topVariation.getPGN();

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      <ScrollArea sx={{ height: boardSize / 3 }} offsetScrollbars>
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
            <RenderVariationTree
              tree={topVariation}
              depth={0}
              first
              setTree={setTree}
              forceUpdate={forceUpdate}
              showVariations={showVariations}
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
  showVariations,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
  showVariations: boolean;
}) {
  const variations = tree.children;
  const moveNodes = showVariations
    ? variations.slice(1).map((variation) => (
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
            showVariations={showVariations}
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
          showVariations={showVariations}
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

export default GameNotation;
