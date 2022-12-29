import { AspectRatio, Container, ScrollArea } from "@mantine/core";
import { useCounter, useHotkeys } from "@mantine/hooks";
import { Chess } from "chess.js";
import { useEffect, useState } from "react";
import Chessground from "react-chessground";
import MoveControls from "./MoveControls";

function BoardView({ pgn }: { pgn: string }) {
  const globalChess = new Chess();
  let totalMoves = 0;
  pgn.split(" ").forEach((move) => {
    globalChess.move(move, { sloppy: true });
    totalMoves += 1;
  });
  const globalPGN = globalChess.pgn();
  const [fen, setFen] = useState("");
  const [curMove, curMoveHandler] = useCounter(totalMoves, {
    min: 0,
    max: totalMoves,
  });

  useEffect(() => {
    const chess = new Chess();
    const moves = pgn.split(" ");
    const movesToLoad = moves.slice(0, curMove);
    movesToLoad.forEach((move) => {
      chess.move(move, { sloppy: true });
    });
    setFen(chess.fen());
  }, [curMove, pgn]);

  useHotkeys([
    ["ArrowLeft", curMoveHandler.decrement],
    ["ArrowRight", curMoveHandler.increment],
  ]);

  return (
    <>
      <Container>
        <AspectRatio ratio={1} mx={100}>
          <Chessground
            animation={{
              enabled: false,
            }}
            style={{ justifyContent: "start" }}
            width={"100%"}
            height={"100%"}
            viewOnly={true}
            fen={fen}
          />
        </AspectRatio>
        <ScrollArea my={20} h={150} offsetScrollbars>
          {globalPGN}
        </ScrollArea>
        <MoveControls
          goToStart={() => curMoveHandler.set(0)}
          goToEnd={() => curMoveHandler.set(totalMoves)}
          redoMove={curMoveHandler.increment}
          undoMove={curMoveHandler.decrement}
        />
      </Container>
    </>
  );
}

export default BoardView;
