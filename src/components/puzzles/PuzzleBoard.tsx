import { Box } from "@mantine/core";
import { useContext, useState } from "react";
import { Completion, Puzzle } from "@/utils/puzzles";
import PromotionModal from "../boards/PromotionModal";
import { chessboard } from "@/styles/Chessboard.css";
import { Chessground } from "@/chessground/Chessground";
import { useAtomValue } from "jotai";
import { showCoordinatesAtom } from "@/atoms/atoms";
import { Chess, NormalMove, makeUci, parseSquare } from "chessops";
import { parseFen } from "chessops/fen";
import { chessgroundDests } from "chessops/compat";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import { countMainPly, getNodeAtPath } from "@/utils/treeReducer";
import { moveToKey } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";

function PuzzleBoard({
  puzzles,
  currentPuzzle,
  changeCompletion,
  generatePuzzle,
  db,
}: {
  puzzles: Puzzle[];
  currentPuzzle: number;
  changeCompletion: (completion: Completion) => void;
  generatePuzzle: (db: string) => void;
  db: string | null;
}) {
  const tree = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);

  const currentNode = getNodeAtPath(tree.root, tree.position);

  let puzzle: Puzzle | null = null;
  if (puzzles.length > 0) {
    puzzle = puzzles[currentPuzzle];
  }
  const [ended, setEnded] = useState(false);

  const [pos] = positionFromFen(currentNode.fen);

  const currentMove = countMainPly(tree.root);
  const orientation = puzzle?.fen
    ? Chess.fromSetup(parseFen(puzzle.fen).unwrap()).unwrap().turn === "white"
      ? "black"
      : "white"
    : "white";
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const dests = chessgroundDests(pos!);
  const turn = pos?.turn || "white";
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
      const newMoves = puzzle.moves.slice(currentMove, currentMove + 2);
      dispatch({
        type: "MAKE_MOVES",
        payload: newMoves,
      });
    } else {
      dispatch({
        type: "MAKE_MOVE",
        payload: move,
      })
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
              checkMove(
                makeUci({
                  from: pendingMove!.from,
                  to: pendingMove!.to,
                  promotion: p,
                })
              );
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
              color: tree.position.length === currentMove ? turn : undefined,
              dests: dests,
              events: {
                after: (orig, dest) => {
                  const from = parseSquare(orig)!;
                  const to = parseSquare(dest)!;
                  const move: NormalMove = { from, to };
                  if (
                    pos?.board.get(from)?.role === "pawn" &&
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
            lastMove={moveToKey(currentNode.move)}
            turnColor={turn}
            fen={currentNode.fen}
            check={pos?.isCheck()}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default PuzzleBoard;
