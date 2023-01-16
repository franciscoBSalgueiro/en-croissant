import { AspectRatio, Container } from "@mantine/core";
import { Chess } from "chess.js";
import Chessground from "react-chessground";
import { formatMove, toDests } from "../../utils/chess";
import { Puzzle } from "./Puzzles";

function PuzzleBoard({ puzzle }: { puzzle: Puzzle }) {
  const chess = new Chess(puzzle.fen);
  const dests = toDests(chess, false);
  const turn = formatMove(chess.turn());

  return (
    <Container sx={{ width: "100%" }}>
      <AspectRatio ratio={1} mx="15%">
        <Chessground
          animation={{
            enabled: true,
          }}
          style={{ justifyContent: "start" }}
          width={"100%"}
          height={"100%"}
          orientation={turn}
          movable={{
            free: false,
            color: turn,
            dests: dests,
          }}
          turnColor={turn}
          fen={puzzle.fen}
          check={chess.inCheck()}
        />
      </AspectRatio>
    </Container>
  );
}

export default PuzzleBoard;
