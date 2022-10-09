import { Button, Group } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import { Chess, PartialMove } from "chess.ts";
import { useEffect, useState } from "react";
import { formatMove, moveToKey, toDests } from "../utils/chess";
import GameNotation from "./GameNotation";

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

  const [variation, setVariation] = useState<Chess>(new Chess(initialFen));
  const [chess, setChess] = useState(new Chess(initialFen));

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

  useEffect(() => {
    if (chess.history().length > variation?.history().length) {
      setVariation(chess);
    }
  }, [chess]);

  const history = variation.clone();
  const moves = [];
  while (history.history().length) {
    moves.push(history.clone());
    history.undo();
  }

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
          <GameNotation moves={moves.reverse()} setChess={setChess} />
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
