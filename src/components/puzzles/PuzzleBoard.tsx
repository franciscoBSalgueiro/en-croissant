import { Box } from "@mantine/core";
import { useContext, useState } from "react";
import { Completion, Puzzle } from "@/utils/puzzles";
import PromotionModal from "../boards/PromotionModal";
import { chessboard } from "@/styles/Chessboard.css";
import { Chessground } from "@/chessground/Chessground";
import { useAtomValue } from "jotai";
import { showCoordinatesAtom } from "@/atoms/atoms";
import { Chess, NormalMove, makeUci, parseSquare, parseUci } from "chessops";
import { parseFen, parsePiece } from "chessops/fen";
import { chessgroundDests } from "chessops/compat";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import { getNodeAtPath, treeIteratorMainLine } from "@/utils/treeReducer";
import { moveToKey } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import equal from "fast-deep-equal";
import { useForceUpdate } from "@mantine/hooks";

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
      if (
        node.move &&
        makeUci({
          from: parseSquare(node.move.from),
          to: parseSquare(node.move.to),
          promotion: node.move.promotion
            ? parsePiece(node.move.promotion)?.role
            : undefined,
        }) === puzzle.moves[currentMove]
      ) {
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

  function checkMove(move: string) {
    if (!pos) return;
    const newPos = pos.clone();
    newPos.play(parseUci(move)!);
    if (
      puzzle &&
      (puzzle.moves[currentMove] === move || newPos.isCheckmate())
    ) {
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
