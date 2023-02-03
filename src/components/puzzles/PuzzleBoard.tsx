import { ActionIcon, AspectRatio, Box, Modal, SimpleGrid } from "@mantine/core";
import {
  IconChessBishop,
  IconChessKnight,
  IconChessQueen,
  IconChessRook
} from "@tabler/icons";
import { BISHOP, Chess, KNIGHT, QUEEN, ROOK, Square } from "chess.js";
import { useState } from "react";
import Chessground from "react-chessground";
import {
  formatMove,
  handleMove,
  moveToKey,
  parseUci,
  toDests
} from "../../utils/chess";
import { Completion, Puzzle } from "./Puzzles";

const promotionPieces = [
  {
    piece: QUEEN,
    icon: <IconChessQueen size={50} />,
  },

  {
    piece: ROOK,
    icon: <IconChessRook size={50} />,
  },

  {
    piece: KNIGHT,
    icon: <IconChessKnight size={50} />,
  },

  {
    piece: BISHOP,
    icon: <IconChessBishop size={50} />,
  },
];

function PuzzleBoard({
  puzzles,
  currentPuzzle,
  changeCompletion,
  generatePuzzle,
  setCurrentPuzzle,
}: {
  puzzles: Puzzle[];
  currentPuzzle: number;
  changeCompletion: (completion: Completion) => void;
  generatePuzzle: () => void;
  setCurrentPuzzle: (currentPuzzle: number) => void;
}) {
  const puzzle = puzzles[currentPuzzle];
  const [chess, setChess] = useState(new Chess(puzzle.fen));
  const [currentMove, setCurrentMove] = useState(0);
  const [ended, setEnded] = useState(false);
  const lastMove = chess.move(parseUci(puzzle.moves[0]));
  const [pendingMove, setPendingMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const dests = toDests(chess, false);
  const turn = formatMove(chess.turn());
  const fen = chess.fen();

  return (
    <div style={{ aspectRatio: 1, position: "relative", zIndex: 1 }}>
      <Modal
        opened={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        withCloseButton={false}
        size={375}
      >
        <SimpleGrid cols={2}>
          {promotionPieces.map((p) => (
            <Box key={p.piece} sx={{ width: "100%", height: "100%" }}>
              <AspectRatio ratio={1}>
                <ActionIcon
                  onClick={() => {
                    if (
                      puzzle.moves[currentMove * 2 + 1] ===
                      `${pendingMove?.from}${pendingMove?.to}${p.piece}`
                    ) {
                      chess.move({
                        from: pendingMove!.from,
                        to: pendingMove!.to,
                        promotion: p.piece,
                      });
                      if (currentMove === puzzle.moves.length / 2 - 1) {
                        if (puzzle.completion !== Completion.INCORRECT) {
                          changeCompletion(Completion.CORRECT);
                        }
                        setCurrentMove(0);
                        setEnded(false);

                        const nextPuzzle = puzzles.findIndex(
                          (p) => p.completion === Completion.INCOMPLETE
                        );

                        if (nextPuzzle !== -1) {
                          setCurrentPuzzle(nextPuzzle);
                        } else {
                          generatePuzzle();
                        }
                      } else {
                        chess.move(parseUci(puzzle.moves[currentMove * 2 + 2]));
                      }
                      setChess(new Chess(chess.fen()));
                      setCurrentMove(currentMove + 1);
                    } else {
                      if (!ended) {
                        changeCompletion(Completion.INCORRECT);
                      }
                      setChess(new Chess(chess.fen()));
                      setEnded(true);
                    }
                    setPendingMove(null);
                  }}
                >
                  {p.icon}
                </ActionIcon>
              </AspectRatio>
            </Box>
          ))}
        </SimpleGrid>
      </Modal>
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
          events: {
            after: (orig, dest, metadata) => {
              let newDest = handleMove(chess, orig, dest)!;
              // handle promotions
              if (
                chess.get(orig as Square).type === "p" &&
                ((newDest[1] === "8" && turn === "white") ||
                  (newDest[1] === "1" && turn === "black"))
              ) {
                setPendingMove({ from: orig as Square, to: newDest });
              } else {
                if (puzzle.moves[currentMove * 2 + 1] === `${orig}${newDest}`) {
                  chess.move({ from: orig as Square, to: newDest });
                  if (currentMove === puzzle.moves.length / 2 - 1) {
                    if (puzzle.completion !== Completion.INCORRECT) {
                      changeCompletion(Completion.CORRECT);
                    }
                    setCurrentMove(0);
                    setEnded(false);

                    const nextPuzzle = puzzles.findIndex(
                      (p) => p.completion === Completion.INCOMPLETE
                    );

                    if (nextPuzzle !== -1) {
                      setCurrentPuzzle(nextPuzzle);
                    } else {
                      generatePuzzle();
                    }
                  } else {
                    chess.move(parseUci(puzzle.moves[currentMove * 2 + 2]));
                  }
                  setChess(new Chess(chess.fen()));
                  setCurrentMove(currentMove + 1);
                } else {
                  if (!ended) {
                    changeCompletion(Completion.INCORRECT);
                  }
                  setChess(new Chess(chess.fen()));
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
    </div>
  );
}

export default PuzzleBoard;
