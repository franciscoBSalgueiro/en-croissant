import { Box, Stack, createStyles } from "@mantine/core";
import { Chess, Move, Square } from "chess.js";
import { useState } from "react";
import Chessground from "react-chessground";
import { handleMove, moveToKey, parseUci, toDests } from "@/utils/chess";
import { formatMove } from "@/utils/format";
import { getBoardSize } from "@/utils/misc";
import { Completion, Puzzle } from "@/utils/puzzles";
import PromotionModal from "../boards/PromotionModal";

const useStyles = createStyles(() => ({
  chessboard: {
    position: "relative",
    marginRight: "auto",
    marginLeft: "auto",
    zIndex: 1,
  },
}));

function PuzzleBoard({
  puzzles,
  currentPuzzle,
  changeCompletion,
  generatePuzzle,
  currentMove,
  setCurrentMove,
  db,
}: {
  puzzles: Puzzle[];
  currentPuzzle: number;
  changeCompletion: (completion: Completion) => void;
  generatePuzzle: (db: string) => void;
  currentMove: number;
  setCurrentMove: (currentMove: number) => void;
  db: string;
}) {
  const puzzle = puzzles[currentPuzzle];
  const [ended, setEnded] = useState(false);
  const chess = new Chess(puzzle.fen);
  let lastMove: Move | null = null;
  let orientation: "white" | "black" = "white";
  for (let i = 0; i < Math.min(currentMove, puzzle.moves.length); i++) {
    lastMove = chess.move(parseUci(puzzle.moves[i]));
    if (i == 0) {
      orientation = formatMove(chess.turn());
    }
  }
  const [pendingMove, setPendingMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const dests = toDests(chess, false);
  const fen = chess.fen();
  const turn = formatMove(chess.turn());

  const boardSize = getBoardSize(window.innerHeight, window.innerWidth);

  const { classes } = useStyles();

  function checkMove(move: string) {
    if (puzzle.moves[currentMove] === move) {
      if (currentMove === puzzle.moves.length - 1) {
        if (puzzle.completion !== "incorrect") {
          changeCompletion("correct");
        }
        setEnded(false);

        generatePuzzle(db);
      }
      setCurrentMove(currentMove + 2);
    } else {
      if (!ended) {
        changeCompletion("incorrect");
      }
      setEnded(true);
    }
  }

  if (!lastMove) return null;

  return (
    <Stack justify="center">
      <Box className={classes.chessboard}>
        <PromotionModal
          pendingMove={pendingMove}
          cancelMove={() => setPendingMove(null)}
          confirmMove={(p) => {
            checkMove(`${pendingMove?.from}${pendingMove?.to}${p}`);
            setPendingMove(null);
          }}
          turn={turn}
          orientation={orientation}
        />
        <Chessground
          animation={{
            enabled: true,
          }}
          style={{ justifyContent: "start" }}
          width={boardSize}
          height={boardSize}
          orientation={orientation}
          movable={{
            free: false,
            color: turn,
            dests: dests,
            events: {
              after: (orig, dest) => {
                const newDest = handleMove(chess, orig, dest);
                if (
                  chess.get(orig as Square).type === "p" &&
                  ((newDest[1] === "8" && turn === "white") ||
                    (newDest[1] === "1" && turn === "black"))
                ) {
                  setPendingMove({ from: orig as Square, to: newDest });
                } else {
                  checkMove(`${orig}${newDest}`);
                }
              },
            },
          }}
          lastMove={moveToKey(lastMove)}
          turnColor={turn}
          fen={fen}
          check={chess.inCheck()}
        />
      </Box>
    </Stack>
  );
}

export default PuzzleBoard;
