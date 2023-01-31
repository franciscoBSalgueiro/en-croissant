import { SimpleGrid, Stack } from "@mantine/core";
import { useHotkeys, useSessionStorage } from "@mantine/hooks";
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

function BoardGame({ id }: { id: string }) {
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
        />
        <Stack>
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
        </Stack>
      </SimpleGrid>
    </TreeContext.Provider>
  );
}

export default BoardGame;
