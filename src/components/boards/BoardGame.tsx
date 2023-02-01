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
import { Icon123, IconUsers } from "@tabler/icons";
import { Chess, Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
  chessToVariatonTree,
  movesToVariationTree,
  VariationTree
} from "../../utils/chess";
import { Game, Outcome, Player, Speed } from "../../utils/db";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import TreeContext from "../common/TreeContext";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

export interface CompleteGame {
  game: Game;
  white: Player;
  black: Player;
  currentMove: number;
}

enum Opponent {
  Easy,
  Medium,
  Hard,
  Human,
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
  name: string;
  description: string;
  Icon: React.FC;
  opponent: Opponent;
  selected: boolean;
  setSelected: (opponent: Opponent) => void;
}

function OpponentCard({
  name,
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
              <Text weight={500}>{name}</Text>
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

function BoardGame({ id }: { id: string }) {
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [selected, setSelected] = useState<Opponent | null>(null);
  const [completeGame, setCompleteGame] = useSessionStorage<CompleteGame>({
    key: id,
    defaultValue: {
      game: {
        white: -1,
        black: -1,
        white_rating: 0,
        black_rating: 0,
        speed: Speed.Unknown,
        outcome: Outcome.Unknown,
        moves: "",
        date: new Date().toLocaleDateString().replace(/\//g, "."),
        site: "",
      },
      white: {
        id: -1,
        name: "White",
        game_count: 0,
      },
      black: {
        id: -1,
        name: "Black",
        game_count: 0,
      },
      currentMove: 0,
    },
  });
  const game = completeGame.game;

  const initial_tree = useMemo(() => {
    if (game.moves[0] === "1" || game.moves[0] === "[") {
      const chess = new Chess();
      chess.loadPgn(game.moves);
      const tree = chessToVariatonTree(chess);
      return tree;
    }
    const tree = movesToVariationTree(game.moves);
    return tree;
  }, [game.moves]);

  function saveGame() {
    setCompleteGame((prev) => {
      const pgn = tree.getTopVariation().getPGN();
      const newTab = {
        ...prev,
      };
      newTab.game.moves = pgn;
      return newTab;
    });
  }

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(initial_tree);
  useEffect(() => {
    setTree(initial_tree);
  }, [initial_tree]);
  const chess = new Chess(tree.fen);

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    const newMove = chess.move(move);
    const newTree = new VariationTree(tree, chess.fen(), newMove);
    if (tree.children.length === 0) {
      tree.children = [newTree];
    } else if (tree.children.every((child) => child.fen !== chess.fen())) {
      tree.children.push(newTree);
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

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["ctrl+S", () => saveGame()],
  ]);

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
        />
        <Stack>
          {opponent === null ? (
            <Card shadow="sm" p="md">
              <Text fw="bold" mb="md">
                Choose an opponent
              </Text>
              <SimpleGrid cols={3} spacing="md">
                <OpponentCard
                  name={"Easy"}
                  description={"800 ELO"}
                  opponent={Opponent.Easy}
                  selected={selected === Opponent.Easy}
                  setSelected={setSelected}
                  Icon={Icon123}
                />
                <OpponentCard
                  name={"Medium"}
                  description={"1500 ELO"}
                  opponent={Opponent.Medium}
                  selected={selected === Opponent.Medium}
                  setSelected={setSelected}
                  Icon={Icon123}
                />
                <OpponentCard
                  name={"Hard"}
                  description={"2500 ELO"}
                  opponent={Opponent.Hard}
                  selected={selected === Opponent.Hard}
                  setSelected={setSelected}
                  Icon={Icon123}
                />

                <OpponentCard
                  name={"Human"}
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
                onClick={() => setOpponent(selected)}
              >
                Play
              </Button>
            </Card>
          ) : (
            <>
              <GameInfo
                white={completeGame.white}
                white_rating={game.white_rating}
                black={completeGame.black}
                black_rating={game.black_rating}
                date={game.date}
                outcome={game.outcome}
              />
              <GameNotation setTree={setTree} />
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
