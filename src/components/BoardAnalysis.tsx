import { Button, Group } from "@mantine/core";
import Chessground from "@react-chess/chessground";
import { Chess, PartialMove } from "chess.ts";
import { useState } from "react";
import { formatMove, getLastMove, moveToKey, toDests } from "../utils/chess";
import GameNotation, { VariationTree } from "./GameNotation";

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  // current position
  const [chess, setChess] = useState<Chess>(tree.position);

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  function buildVariationTree(chess: Chess): VariationTree {
    const tree: VariationTree = {
      parent: null,
      position: chess,
      children: [],
    };

    if (chess.history().length > 0) {
      const parent = chess.undo();
      if (parent) {
        tree.parent = buildVariationTree(chess);
      }
    }

    return tree;
  }

  function appendMoveToTree(move: PartialMove): void {
    const newPosition = chess.clone();
    newPosition.move(move);
    const newTree: VariationTree = {
      parent: tree,
      position: newPosition,
      children: [],
    };
    const newTreeParent = tree.children.find(
      (child) => child.position.fen() === newPosition.fen()
    );
    if (newTreeParent) {
      setTree(newTreeParent);
    } else {
      tree.children.push(newTree);
      setTree(newTree);
    }
    setChess(newPosition);
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
      setChess(tree.parent.position);
    }
  }

  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(getLastMove(chess));

  console.log(tree);
  console.log(chess.pgn());

  return (
    <>
      <Group grow align={"flex-start"}>
        <div
          style={{
            width: "70vw",
            height: "70vw",
            maxHeight: "90vh",
            maxWidth: "90vh",
            margin: "auto",
          }}
        >
          <Chessground
            contained
            config={{
              orientation: formatMove(orientation),
              fen: chess.fen(),
              movable: {
                free: false,
                color: turn,
                dests: dests,
                events: {
                  after: (orig, dest) => {
                    appendMoveToTree({ from: orig, to: dest });
                  },
                },
              },
              turnColor: turn,
              check: chess.inCheck(),
              lastMove,
            }}
          />
        </div>
        <div>
          <GameNotation tree={tree} setChess={setChess} />
        </div>
      </Group>

      <Button onClick={() => setOrientation(orientation === "w" ? "b" : "w")}>
        Flip
      </Button>
      <Button onClick={() => undoMove()}>Back</Button>
    </>
  );
}

export default BoardAnalysis;
