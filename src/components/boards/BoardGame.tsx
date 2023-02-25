import {
  Button,
  Card,
  createStyles,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text
} from "@mantine/core";
import { useHotkeys, useSessionStorage } from "@mantine/hooks";
import { IconPlus, IconRobot, IconUsers, IconZoomCheck } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import { Chess, DEFAULT_POSITION, Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
  goToPosition,
  movesToVariationTree,
  parsePGN,
  parseUci,
  VariationTree
} from "../../utils/chess";
import { CompleteGame, defaultGame, Outcome } from "../../utils/db";
import { Engine, getEngines } from "../../utils/engines";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import TreeContext from "../common/TreeContext";
import { Tab } from "../tabs/BoardsPage";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

enum Opponent {
  Easy = "Easy Bot",
  Medium = "Medium Bot",
  Hard = "Hard Bot",
  Human = "Human",
}

const useStyles = createStyles(
  (theme, { selected }: { selected: boolean }) => ({
    card: {
      cursor: "pointer",
      backgroundColor: selected
        ? theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0]
        : theme.colorScheme === "dark"
        ? theme.colors.dark[7]
        : theme.white,

      borderColor: selected
        ? theme.colors[theme.primaryColor][6]
        : "transparent",
      borderWidth: 2,

      "&:hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[0],
        borderColor: selected
          ? theme.colors[theme.primaryColor][6]
          : theme.colors.gray[6],
      },
    },

    label: {
      marginBottom: theme.spacing.xs,
      lineHeight: 1,
      fontWeight: 700,
      fontSize: theme.fontSizes.xs,
      letterSpacing: -0.25,
      textTransform: "uppercase",
    },

    info: {
      display: "flex",
      justifyContent: "space-between",
    },
  })
);

interface OpponentCardProps {
  description: string;
  Icon: React.FC;
  opponent: Opponent;
  selected: boolean;
  setSelected: (opponent: Opponent) => void;
}

function OpponentCard({
  description,
  opponent,
  selected,
  Icon,
  setSelected,
}: OpponentCardProps) {
  const { classes } = useStyles({ selected });

  return (
    <>
      <Card
        withBorder
        radius="md"
        className={classes.card}
        onClick={() => setSelected(opponent)}
      >
        <Stack>
          <Group noWrap>
            <Icon />
            <div>
              <Text weight={500}>{opponent}</Text>
              <Text size="xs" color="dimmed">
                {description}
              </Text>
            </div>
          </Group>
        </Stack>
      </Card>
    </>
  );
}

function BoardGame({
  id,
  tabs,
  setTabs,
}: {
  id: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}) {
  const [opponent, setOpponent] = useSessionStorage<Opponent | null>({
    key: id + "-opponent",
    defaultValue: null,
  });
  const [selected, setSelected] = useState<Opponent | null>(null);
  const [completeGame, setCompleteGame] = useSessionStorage<CompleteGame>({
    key: id,
    defaultValue: { game: defaultGame(), currentMove: [] },
  });
  const [engines, setEngines] = useState<Engine[]>([]);
  const game = completeGame.game;

  const initial_tree = useMemo(() => {
    if (game.moves[0] === "1" || game.moves[0] === "[") {
      const tree = parsePGN(game.moves);
      return tree;
    }
    const tree = movesToVariationTree(game.moves);
    return tree;
  }, [game.moves]);

  // Variation tree of all the previous moves
  const [tree, setTree] = useSessionStorage<VariationTree>({
    key: id + "-tree",
    defaultValue: initial_tree,
    serialize: (value) => {
      const storedTree = JSON.stringify({
        pgn: value.getTopVariation().getPGN(),
        currentMove: value.getPosition(),
      });
      return storedTree;
    },
    deserialize: (value) => {
      const { pgn, currentMove } = JSON.parse(value);
      const tree = parsePGN(pgn);
      const treeAtPosition = goToPosition(tree, currentMove);
      return treeAtPosition;
    },
  });
  const chess = new Chess(tree.fen);

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    const newMove = chess.move(move);
    const newTree = new VariationTree(tree, chess.fen(), newMove);
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children.every((child) => child.fen !== chess.fen())) {
      tree.children.push(newTree);
    } else {
      const child = tree.children.find((child) => child.fen === chess.fen());
      setTree(child!);
      return;
    }
    setTree(newTree);
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
    }
  }

  function redoMove() {
    if (tree.children.length > 0) {
      setTree(tree.children[0]);
    }
  }

  function goToStart() {
    setTree(tree.getTopVariation());
  }

  function goToEnd() {
    setTree(tree.getBottomVariation());
  }

  function changeToAnalysisMode() {
    setTabs(
      tabs.map((tab) => (tab.value === id ? { ...tab, type: "analysis" } : tab))
    );
  }

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
  ]);

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);

  useEffect(() => {
    if (engines.length > 0 && tree.half_moves % 2 === 1) {
      invoke("get_single_best_move", {
        difficulty: 0,
        engine: engines[0].path,
        fen: tree.fen,
      }).then((move) => {
        console.log(move);
        makeMove(parseUci(move as string));
      });
    }
  }, [tree, engines]);

  return (
    <TreeContext.Provider value={tree}>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
        <BoardPlay
          makeMove={makeMove}
          arrows={[]}
          editingMode={false}
          toggleEditingMode={() => {}}
          viewOnly={opponent === null}
          disableVariations
          setCompleteGame={setCompleteGame}
          completeGame={completeGame}
        />
        <Stack>
          {opponent === null ? (
            <Card shadow="sm" p="md">
              <Text fw="bold" mb="md">
                Choose an opponent
              </Text>
              <SimpleGrid cols={3} spacing="md">
                <OpponentCard
                  description={"800 ELO"}
                  opponent={Opponent.Easy}
                  selected={selected === Opponent.Easy}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  description={"1500 ELO"}
                  opponent={Opponent.Medium}
                  selected={selected === Opponent.Medium}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  description={"2500 ELO"}
                  opponent={Opponent.Hard}
                  selected={selected === Opponent.Hard}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />

                <OpponentCard
                  description={""}
                  opponent={Opponent.Human}
                  selected={selected === Opponent.Human}
                  setSelected={setSelected}
                  Icon={IconUsers}
                />
              </SimpleGrid>

              <Divider my="md" />

              <Button
                disabled={selected === null}
                onClick={() => {
                  setOpponent(selected);
                  setCompleteGame((prev) => ({
                    game: {
                      ...prev.game,
                      white: {
                        id: -1,
                        name: "You",
                      },
                      black: {
                        id: -1,
                        name: selected ?? "",
                      },
                    },
                    currentMove: [],
                  }));
                }}
              >
                Play
              </Button>
            </Card>
          ) : (
            <>
              <GameInfo game={game} />
              <Group grow>
                <Button
                  onClick={() => {
                    setOpponent(null);
                    setTree(new VariationTree(null, DEFAULT_POSITION, null));
                  }}
                  leftIcon={<IconPlus />}
                >
                  New Game
                </Button>
                <Button
                  variant="default"
                  onClick={() => changeToAnalysisMode()}
                  leftIcon={<IconZoomCheck />}
                >
                  Analyze
                </Button>
              </Group>
              <GameNotation
                setTree={setTree}
                topVariation={tree.getTopVariation()}
                result={Outcome.Unknown}
                boardSize={600}
              />
              <MoveControls
                goToStart={goToStart}
                goToEnd={goToEnd}
                redoMove={redoMove}
                undoMove={undoMove}
              />
            </>
          )}
        </Stack>
      </SimpleGrid>
    </TreeContext.Provider>
  );
}

export default BoardGame;
