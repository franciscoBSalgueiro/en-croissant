import {
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useHotkeys, useSessionStorage } from "@mantine/hooks";
import {
  IconDice,
  IconPlus,
  IconRobot,
  IconUsers,
  IconZoomCheck,
} from "@tabler/icons-react";
import { Chess, DEFAULT_POSITION, Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
  VariationTree,
  goToPosition,
  movesToVariationTree,
  parsePGN,
  parseUci,
} from "../../utils/chess";
import { CompleteGame, Outcome, defaultGame } from "../../utils/db";
import { Engine, getEngines } from "../../utils/engines";
import { invoke } from "../../utils/misc";
import { Tab } from "../../utils/tabs";
import GameInfo from "../common/GameInfo";
import GenericCard from "../common/GenericCard";
import MoveControls from "../common/MoveControls";
import TreeContext from "../common/TreeContext";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

enum Opponent {
  Random = "Random Bot",
  Easy = "Easy Bot",
  Medium = "Medium Bot",
  Hard = "Hard Bot",
  Impossible = "Impossible Bot",
  Human = "Human",
}

interface OpponentCardProps {
  Icon: React.FC;
  opponent: Opponent;
  isSelected: boolean;
  setSelected: React.Dispatch<React.SetStateAction<Opponent | null>>;
}

function OpponentCard({
  opponent,
  isSelected,
  Icon,
  setSelected,
}: OpponentCardProps) {
  return (
    <GenericCard
      id={opponent}
      isSelected={isSelected}
      setSelected={setSelected}
      Header={
        <Group noWrap>
          <Icon />
          <Text weight={500}>{opponent}</Text>
        </Group>
      }
    />
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
  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white"
  );
  const [playingColor, setPlayingColor] = useState<"white" | "black">("white");
  const [engine, setEngine] = useState<string | null>(null);
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
        pgn: value.getTopVariation().getPGN({ headers: game }),
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
    let isBotTurn = false;
    if (playingColor === "black") {
      isBotTurn = chess.turn() === "w";
    } else if (playingColor === "white") {
      isBotTurn = chess.turn() === "b";
    }
    if (
      tree.children.length === 0 &&
      opponent &&
      opponent !== Opponent.Human &&
      isBotTurn
    ) {
      let engineLevel;
      if (opponent === Opponent.Random) {
        invoke("make_random_move", {
          fen: tree.fen,
        }).then((move) => {
          makeMove(parseUci(move as string));
        });
      } else if (engine) {
        if (opponent === Opponent.Easy) {
          engineLevel = 2;
        } else if (opponent === Opponent.Medium) {
          engineLevel = 4;
        } else if (opponent === Opponent.Hard) {
          engineLevel = 6;
        } else if (opponent === Opponent.Impossible) {
          engineLevel = 8;
        }
        invoke("get_single_best_move", {
          difficulty: engineLevel,
          engine,
          fen: tree.fen,
        }).then((move) => {
          makeMove(parseUci(move as string));
        });
      }
    }
  }, [tree, engine, playingColor]);

  return (
    <TreeContext.Provider value={tree}>
      <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
        <BoardPlay
          makeMove={makeMove}
          arrows={[]}
          forceUpdate={() => {}}
          setTree={setTree}
          editingMode={false}
          toggleEditingMode={() => {}}
          viewOnly={opponent === null}
          disableVariations
          setCompleteGame={setCompleteGame}
          completeGame={completeGame}
          side={playingColor}
          addPiece={() => {}}
        />
        <Stack>
          {opponent === null ? (
            <Card shadow="sm" p="md">
              <Text fw="bold" mb="md">
                Choose an opponent
              </Text>
              <SimpleGrid cols={3} spacing="md">
                <OpponentCard
                  opponent={Opponent.Random}
                  isSelected={selected === Opponent.Random}
                  setSelected={setSelected}
                  Icon={IconDice}
                />
                <OpponentCard
                  opponent={Opponent.Easy}
                  isSelected={selected === Opponent.Easy}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  opponent={Opponent.Medium}
                  isSelected={selected === Opponent.Medium}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  opponent={Opponent.Hard}
                  isSelected={selected === Opponent.Hard}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  opponent={Opponent.Impossible}
                  isSelected={selected === Opponent.Impossible}
                  setSelected={setSelected}
                  Icon={IconRobot}
                />
                <OpponentCard
                  opponent={Opponent.Human}
                  isSelected={selected === Opponent.Human}
                  setSelected={setSelected}
                  Icon={IconUsers}
                />
              </SimpleGrid>
              {(selected === Opponent.Easy ||
                selected === Opponent.Medium ||
                selected === Opponent.Hard ||
                selected === Opponent.Impossible) && (
                <Select
                  mt="md"
                  w={200}
                  label="Engine"
                  data={engines.map((engine) => ({
                    label: engine.name,
                    value: engine.path,
                  }))}
                  value={engine}
                  onChange={(e) => {
                    setEngine(e as string);
                  }}
                />
              )}

              <Select
                mt="md"
                w={200}
                label="Color"
                data={[
                  { value: "white", label: "White" },
                  { value: "random", label: "Random" },
                  { value: "black", label: "Black" },
                ]}
                value={inputColor}
                onChange={(e) => {
                  setInputColor(e as "white" | "black" | "random");
                }}
              />

              <Divider my="md" />
              <Button
                disabled={
                  selected === null ||
                  ((selected === Opponent.Easy ||
                    selected === Opponent.Medium ||
                    selected === Opponent.Hard ||
                    selected === Opponent.Impossible) &&
                    engine === null)
                }
                onClick={() => {
                  setPlayingColor(
                    inputColor === "random"
                      ? Math.random() > 0.5
                        ? "white"
                        : "black"
                      : inputColor
                  );
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
                    setCompleteGame((prev) => ({
                      game: {
                        ...prev.game,
                        result: Outcome.Unknown,
                      },
                      currentMove: [],
                    }));
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
                game={game}
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
