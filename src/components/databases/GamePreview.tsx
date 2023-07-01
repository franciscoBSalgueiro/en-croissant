import { AspectRatio, Container, ScrollArea } from "@mantine/core";
import { useCounter, useHotkeys } from "@mantine/hooks";
import { Chess } from "chess.js";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Chessground from "react-chessground";
import MoveControls from "../common/MoveControls";
import { useSetAtom } from "jotai";
import { activeTabAtom } from "../../atoms/tabs";

function GamePreview({
  id,
  pgn,
  hideControls,
}: {
  id?: string;
  pgn: string;
  hideControls?: boolean;
}) {
  const router = useRouter();
  const globalChess = new Chess();
  let totalMoves = 0;
  pgn.split(" ").forEach((move) => {
    globalChess.move(move);
    totalMoves += 1;
  });
  const globalPGN = globalChess.pgn();
  const [fen, setFen] = useState("");
  const [curMove, curMoveHandler] = useCounter(totalMoves, {
    min: 0,
    max: totalMoves,
  });

  const setActiveTab = useSetAtom(activeTabAtom);

  useEffect(() => {
    const chess = new Chess();
    const moves = pgn.split(" ");
    const movesToLoad = moves.slice(0, curMove);
    movesToLoad.forEach((move) => {
      chess.move(move);
    });
    setFen(chess.fen());
  }, [curMove, pgn]);

  useHotkeys([
    ["ArrowLeft", curMoveHandler.decrement],
    ["ArrowRight", curMoveHandler.increment],
  ]);

  function goToGame() {
    if (id) {
      setActiveTab(id);
      router.push("/boards");
    }
  }

  return (
    <>
      <Container sx={{ width: "100%" }} onClick={() => goToGame()}>
        <AspectRatio ratio={1} mx="15%">
          <Chessground
            coordinates={false}
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
        {!hideControls && (
          <>
            <ScrollArea my={20} h={100} offsetScrollbars>
              {globalPGN}
            </ScrollArea>
            <MoveControls
              goToStart={() => curMoveHandler.set(0)}
              goToEnd={() => curMoveHandler.set(totalMoves)}
              goToNext={curMoveHandler.increment}
              goToPrevious={curMoveHandler.decrement}
            />
          </>
        )}
      </Container>
    </>
  );
}

export default GamePreview;
