import { showCoordinatesAtom } from "@/atoms/atoms";
import { Chessground } from "@/chessground/Chessground";
import { chessboard } from "@/styles/Chessboard.css";
import { positionFromFen } from "@/utils/chessops";
import { Completion, Puzzle } from "@/utils/puzzles";
import { getNodeAtPath, treeIteratorMainLine } from "@/utils/treeReducer";
import { Box } from "@mantine/core";
import { useForceUpdate } from "@mantine/hooks";
import { Chess, Move, NormalMove, makeUci, parseSquare } from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { parseFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtomValue } from "jotai";
import { useContext, useState } from "react";
import * as classes from "../boards/Board.css";
import PromotionModal from "../boards/PromotionModal";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";

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
  const reset = useForceUpdate();

  const currentNode = getNodeAtPath(tree.root, tree.position);

  let puzzle: Puzzle | null = null;
  if (puzzles.length > 0) {
    puzzle = puzzles[currentPuzzle];
  }
  const [ended, setEnded] = useState(false);

  const [pos] = positionFromFen(currentNode.fen);

  const treeIter = treeIteratorMainLine(tree.root);
  treeIter.next();
  let currentMove = 0;
  if (puzzle) {
    for (const { node } of treeIter) {
      if (node.move && makeUci(node.move) === puzzle.moves[currentMove]) {
        currentMove++;
      } else {
        break;
      }
    }
  }
  const orientation = puzzle?.fen
    ? Chess.fromSetup(parseFen(puzzle.fen).unwrap()).unwrap().turn === "white"
      ? "black"
      : "white"
    : "white";
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const dests = chessgroundDests(pos!);
  const turn = pos?.turn || "white";
  const showCoordinates = useAtomValue(showCoordinatesAtom);

  function checkMove(move: Move) {
    if (!pos) return;
    const newPos = pos.clone();
    const uci = makeUci(move);
    newPos.play(move);
    if (puzzle && (puzzle.moves[currentMove] === uci || newPos.isCheckmate())) {
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
        mainline: true,
      });
    } else {
      dispatch({
        type: "MAKE_MOVE",
        payload: move,
        changePosition: false,
      });
      if (!ended) {
        changeCompletion("incorrect");
      }
      setEnded(true);
    }
    reset();
  }

  return (
    <Box
      className={classes.container}
      style={{
        gridTemplateAreas: `
      "Board Board Board"
      "Board Board Board"
      "Board Board Board"
    `,
      }}
    >
      <Box className={classes.board}>
        <Box className={chessboard}>
          <PromotionModal
            pendingMove={pendingMove}
            cancelMove={() => setPendingMove(null)}
            confirmMove={(p) => {
              if (pendingMove) {
                checkMove({ ...pendingMove, promotion: p });
                setPendingMove(null);
              }
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
              color:
                puzzle && equal(tree.position, Array(currentMove).fill(0))
                  ? turn
                  : undefined,
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
                    checkMove(move);
                  }
                },
              },
            }}
            lastMove={
              currentNode.move ? chessgroundMove(currentNode.move) : undefined
            }
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
