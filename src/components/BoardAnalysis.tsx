import { Button, Group, SimpleGrid } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import { Chess, PartialMove } from "chess.ts";
import { useState } from "react";
import { formatMove, moveToKey, toDests } from "../utils/chess";

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

  const [chess, setChess] = useState(new Chess(initialFen));

  const [orientation, setOrientation] = useState("w");
  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(chess.history({ verbose: true }).pop());
  const history = chess.clone();
  const moves = history.history().map((_, i) => {
    if (i > 0) {
      history.undo();
    }
    return history.clone();
  });

  useWindowEvent("keydown", (event) => {
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      undoMove();
    }
  });

  return (
    <>
      <Group grow>
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

        <SimpleGrid cols={2}>
          {moves.reverse().map((chess) => (
            <MoveCell move={chess} />
          ))}
        </SimpleGrid>
      </Group>

      <Button onClick={() => setOrientation(orientation === "w" ? "b" : "w")}>
        Flip
      </Button>
      <Button onClick={() => undoMove()}>Back</Button>
      <Button onClick={() => setChess(new Chess())}>Test</Button>
    </>
  );

  function MoveCell({ move }: { move: Chess }) {
    return (
      <Group position="center">
        <Button
          onClick={() => {
            setChess(move);
          }}
        >
          {move.history().pop()}
        </Button>
      </Group>
    );
  }
}

export default BoardAnalysis;
