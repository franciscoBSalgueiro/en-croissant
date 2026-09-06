import { Box } from "@mantine/core";
import { useElementSize, useForceUpdate } from "@mantine/hooks";
import { type Move, makeUci, type NormalMove, parseSquare } from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { parseFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import { useContext, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Chessground } from "@/chessground/Chessground";
import {
  bestMovesFamily,
  jumpToNextPuzzleAtom,
  moveHighlightAtom,
  showArrowsAtom,
  showConsecutiveArrowsAtom,
  showCoordinatesAtom,
} from "@/state/atoms";
import classes from "@/styles/Chessboard.module.css";
import { getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import type { Completion, Puzzle } from "@/utils/puzzles";
import { getNodeAtPath, treeIteratorMainLine } from "@/utils/treeReducer";
import PromotionModal from "../boards/PromotionModal";
import { getEngineArrowShapes } from "../boards/engineArrowShapes";
import { TreeStateContext } from "../common/TreeStateContext";

function PuzzleBoard({
  puzzles,
  currentPuzzle,
  changeCompletion,
  generatePuzzle,
  db,
  reviewMode,
  enterReviewMode,
}: {
  puzzles: Puzzle[];
  currentPuzzle: number;
  changeCompletion: (completion: Completion) => Promise<void>;
  generatePuzzle: (db: string) => Promise<void>;
  db: string | null;
  reviewMode: boolean;
  enterReviewMode: () => void;
}) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const moveHighlight = useAtomValue(moveHighlightAtom);
  const boardShapes = useStore(store, (s) => s.currentNode().shapes);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );
  const makeMove = useStore(store, (s) => s.makeMove);
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const reset = useForceUpdate();
  const [jumpToNextPuzzleImmediately] = useAtom(jumpToNextPuzzleAtom);

  const currentNode = getNodeAtPath(root, position);

  let puzzle: Puzzle | null = null;
  if (puzzles.length > 0) {
    puzzle = puzzles[currentPuzzle];
  }
  const [ended, setEnded] = useState(false);

  const [pos] = positionFromFen(currentNode.fen);

  const treeIter = treeIteratorMainLine(root);
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
    ? parseFen(puzzle.fen).unwrap().turn === "white"
      ? "black"
      : "white"
    : "white";
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const dests = pos ? chessgroundDests(pos) : new Map();
  const turn = pos?.turn || "white";
  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const showConsecutiveArrows = useAtomValue(showConsecutiveArrowsAtom);
  const engineArrows = useAtomValue(bestMovesFamily({ fen: root.fen, gameMoves: moves }));
  const autoShapes =
    reviewMode && showArrows && pos && engineArrows.size > 0
      ? getEngineArrowShapes({
          arrows: engineArrows,
          pos,
          showConsecutiveArrows,
        }).concat(boardShapes)
      : boardShapes;

  async function checkMove(move: Move) {
    if (!pos) return;
    if (!puzzle) return;

    const newPos = pos.clone();
    const uci = makeUci(move);
    newPos.play(move);

    if (puzzle.moves[currentMove] === uci || newPos.isCheckmate()) {
      if (currentMove === puzzle.moves.length - 1) {
        if (puzzle.completion !== "incorrect") {
          await changeCompletion("correct");
        }
        setEnded(false);
      }
      const newMoves = puzzle.moves.slice(currentMove, currentMove + 2);
      makeMoves({
        payload: newMoves,
        mainline: true,
        changeHeaders: false,
      });
      if (currentMove === puzzle.moves.length - 1) {
        if (db && jumpToNextPuzzleImmediately) {
          await generatePuzzle(db);
        } else {
          enterReviewMode();
        }
      }
    } else {
      makeMove({
        payload: move,
        changePosition: false,
        changeHeaders: false,
      });
      if (!ended) {
        await changeCompletion("incorrect");
      }
      setEnded(true);
    }
    reset();
  }

  function playMove(move: Move) {
    if (reviewMode) {
      makeMove({
        payload: move,
        changeHeaders: false,
      });
      reset();
      return;
    }
    void checkMove(move);
  }

  const { ref: parentRef, height: parentHeight } = useElementSize();

  return (
    <Box w="100%" h="100%" ref={parentRef}>
      <Box
        className={classes.chessboard}
        style={{
          maxWidth: parentHeight,
        }}
      >
        <PromotionModal
          pendingMove={pendingMove}
          cancelMove={() => setPendingMove(null)}
          confirmMove={async (p) => {
            if (pendingMove) {
              playMove({ ...pendingMove, promotion: p });
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
          coordinates={showCoordinates !== "no"}
          coordinatesOnSquares={showCoordinates === "all"}
          orientation={orientation}
          drawable={{
            enabled: true,
            visible: true,
            autoShapes,
          }}
          movable={{
            free: false,
            color:
              reviewMode ||
              (puzzle &&
                equal(position, Array(currentMove).fill(0)) &&
                (puzzle.completion === "incomplete" || puzzle.completion === "incorrect"))
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
                  ((dest[1] === "8" && turn === "white") || (dest[1] === "1" && turn === "black"))
                ) {
                  setPendingMove(move);
                } else {
                  playMove(move);
                }
              },
            },
          }}
          lastMove={
            moveHighlight && currentNode.move ? chessgroundMove(currentNode.move) : undefined
          }
          turnColor={turn}
          fen={currentNode.fen}
          check={moveHighlight && pos?.isCheck()}
        />
      </Box>
    </Box>
  );
}

export default PuzzleBoard;
