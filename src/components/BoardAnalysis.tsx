import { Button, Group, SimpleGrid } from "@mantine/core";
import Chessground from "@react-chess/chessground";
import { Chess } from "chess.ts";
import { useState } from "react";
import { toDests } from "../utils/chess";

function MoveCell({ move }: { move: string }) {
  return (
    <Group position="center">
      <Button>{move}</Button>
    </Group>
  );
}

function BoardAnalysis() {
  function formatOrientation(orientation: string) {
    return orientation === "w" ? "white" : "black";
  }
  const fen = "rnbqkbnr/pppppppp/8/8/5P1R/8/PPPPP1PP/RNBQKBN1 w Qkq - 0 1";
  const [chess, setChess] = useState(new Chess(fen));
  const [orientation, setOrientation] = useState("w");

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
              orientation: formatOrientation(orientation),
              fen: chess.fen(),
              movable: {
                free: false,
                color: formatOrientation(chess.turn()),
                dests: toDests(chess),
                events: {
                  after: (orig, dest) => {
                    chess.move({ from: orig, to: dest });
                    setChess(chess.clone());
                  },
                },
              },
              check: chess.inCheck(),
            }}
          />
        </div>

        <SimpleGrid cols={2}>
          {chess.history().map((move) => (
            <MoveCell move={move} />
          ))}
        </SimpleGrid>
      </Group>

      <Button onClick={() => setOrientation(orientation === "w" ? "b" : "w")}>
        Flip
      </Button>
    </>
  );
}

export default BoardAnalysis;
