import { Button, Group } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import { Chess, PartialMove } from "chess.ts";
import { useState } from "react";
import { formatMove, moveToKey, toDests } from "../utils/chess";
import GameNotation, { VariationTree } from "./GameNotation";

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  function makeMove(move: string | PartialMove) {
    const newChess = chess.clone();
    newChess.move(move);
    setChess(newChess);
  }

  function undoMove() {
    const newChess = chess.clone();
    newChess.undo();
    setChess(newChess);
  }

  function buildVariationTree(chess: Chess) {
    const clone = chess.clone();
    const tree: VariationTree = {
      move: clone.history({ verbose: true }).pop(),
      children: [],
    };
    const moves = clone.moves({ verbose: true });
    for (const move of moves) {
      clone.move(move);
      tree.children.push(buildVariationTree(clone));
    }
    return tree;
  }

  const [chess, setChess] = useState(new Chess(initialFen));
  const [variationTree, setVariationTree] = useState<VariationTree>(
    buildVariationTree(chess)
  );

  const [orientation, setOrientation] = useState("w");
  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(chess.history({ verbose: true }).pop());

  useWindowEvent("keydown", (event) => {
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      undoMove();
    }
  });

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
                    makeMove({ from: orig, to: dest });
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
          <GameNotation tree={variationTree} setChess={setChess} />
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
