import { Box } from "@mantine/core";
import { useState } from "react";
import { Completion, Puzzle } from "@/utils/puzzles";
import PromotionModal from "../boards/PromotionModal";
import { chessboard } from "@/styles/Chessboard.css";
import { Chessground } from "@/chessground/Chessground";
import { useAtomValue } from "jotai";
import { showCoordinatesAtom } from "@/atoms/atoms";
import { Chess, NormalMove, makeUci, parseSquare, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { chessgroundDests, chessgroundMove } from "chessops/compat";

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
  db: string | null;
}) {
  let puzzle: Puzzle | null = null;
  if (puzzles.length > 0) {
    puzzle = puzzles[currentPuzzle];
  }
  const [ended, setEnded] = useState(false);

  const pos = puzzle?.fen
    ? Chess.fromSetup(parseFen(puzzle.fen).unwrap()).unwrap()
    : Chess.default();
  let lastMove: NormalMove | null = null;
  let orientation: "white" | "black" = "white";
  if (puzzle) {
    for (let i = 0; i < Math.min(currentMove, puzzle.moves.length); i++) {
      lastMove = parseUci(puzzle.moves[i])! as NormalMove;
      pos.play(lastMove);
      if (i == 0) {
        orientation = pos.turn;
      }
    }
  }
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const dests = chessgroundDests(pos);
  const fen = makeFen(pos.toSetup());
  const turn = pos.turn;
  const showCoordinates = useAtomValue(showCoordinatesAtom);

  function checkMove(move: string) {
    if (puzzle && puzzle.moves[currentMove] === move) {
      if (currentMove === puzzle.moves.length - 1) {
        if (puzzle.completion !== "incorrect") {
          changeCompletion("correct");
        }
        setEnded(false);

        if (db) {
          generatePuzzle(db);
        }
      }
      setCurrentMove(currentMove + 2);
    } else {
      if (!ended) {
        changeCompletion("incorrect");
      }
      setEnded(true);
    }
  }

  return (
    <Box
      className="container"
      style={{
        gridTemplateAreas: `
      "Board Board Board"
      "Board Board Board"
      "Board Board Board"
    `,
      }}
    >
      <Box className="Board">
        <Box className={chessboard}>
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
            coordinates={showCoordinates}
            orientation={orientation}
            movable={{
              free: false,
              color: lastMove ? turn : undefined,
              dests: dests,
              events: {
                after: (orig, dest) => {
                  const from = parseSquare(orig)!;
                  const to = parseSquare(dest)!;
                  const move: NormalMove = { from, to };
                  if (
                    pos.board.get(from)?.role === "pawn" &&
                    ((dest[1] === "8" && turn === "white") ||
                      (dest[1] === "1" && turn === "black"))
                  ) {
                    setPendingMove(move);
                  } else {
                    checkMove(makeUci(move));
                  }
                },
              },
            }}
            lastMove={lastMove ? chessgroundMove(lastMove) : undefined}
            turnColor={turn}
            fen={fen}
            check={pos.isCheck()}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default PuzzleBoard;
