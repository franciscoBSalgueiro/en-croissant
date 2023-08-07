import {
  ActionIcon,
  Box,
  Modal,
  SimpleGrid,
  Stack,
  createStyles,
} from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import {
  BISHOP,
  Chess,
  KNIGHT,
  Move,
  PieceSymbol,
  QUEEN,
  ROOK,
  Square,
} from "chess.js";
import { useState } from "react";
import Chessground from "react-chessground";
import { handleMove, moveToKey, parseUci, toDests } from "@/utils/chess";
import { formatMove } from "@/utils/format";
import { getBoardSize } from "@/utils/misc";
import { Completion, Puzzle } from "@/utils/puzzles";
import Piece from "../common/Piece";

const useStyles = createStyles(() => ({
  chessboard: {
    position: "relative",
    marginRight: "auto",
    marginLeft: "auto",
    zIndex: 1,
  },
}));

const promotionPieces: PieceSymbol[] = [QUEEN, KNIGHT, ROOK, BISHOP];

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

  const { height, width } = useViewportSize();

  const boardSize = getBoardSize(height, width);

  const { classes } = useStyles();

  if (!lastMove) return null;

  return (
    <Stack justify="center">
      <Modal
        opened={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        withCloseButton={false}
        size={375}
      >
        <SimpleGrid cols={2}>
          {promotionPieces.map((p) => (
            <ActionIcon
              key={p}
              sx={{ width: "100%", height: "100%", position: "relative" }}
              onClick={() => {
                if (
                  puzzle.moves[currentMove] ===
                  `${pendingMove?.from}${pendingMove?.to}${p}`
                ) {
                  chess.move({
                    from: pendingMove!.from,
                    to: pendingMove!.to,
                    promotion: p,
                  });
                  if (currentMove === puzzle.moves.length) {
                    if (puzzle.completion !== "incorrect") {
                      changeCompletion("correct");
                    }
                    setCurrentMove(1);
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
                setPendingMove(null);
              }}
            >
              <Piece
                piece={{
                  type: p,
                  color: turn === "white" ? "w" : "b",
                }}
              />
            </ActionIcon>
          ))}
        </SimpleGrid>
      </Modal>
      <Box className={classes.chessboard}>
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
                // handle promotions
                if (
                  chess.get(orig as Square).type === "p" &&
                  ((newDest[1] === "8" && turn === "white") ||
                    (newDest[1] === "1" && turn === "black"))
                ) {
                  setPendingMove({ from: orig as Square, to: newDest });
                } else {
                  if (puzzle.moves[currentMove] === `${orig}${newDest}`) {
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
                  // makeMove({
                  //   from: orig as Square,
                  //   to: newDest,
                  // });
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
