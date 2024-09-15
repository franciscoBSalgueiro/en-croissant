import type { Score } from "@/bindings";
import { Chessground } from "@/chessground/Chessground";
import MoveCell from "@/components/common/MoveCell";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { previewBoardOnHoverAtom, scoreTypeFamily } from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { ActionIcon, Box, Flex, Portal, Table } from "@mantine/core";
import { useForceUpdate } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import type { Key } from "chessground/types";
import { chessgroundMove } from "chessops/compat";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { useAtom, useAtomValue } from "jotai";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import React from "react";
import { useStore } from "zustand";
import ScoreBubble from "./ScoreBubble";

function AnalysisRow({
  engine,
  score,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
}: {
  engine: string;
  score: Score;
  moves: string[];
  halfMoves: number;
  threat: boolean;
  fen: string;
  orientation: "white" | "black";
}) {
  const [open, setOpen] = useState<boolean>(false);

  if (!open) {
    moves = moves.slice(0, 12);
  }
  const [pos] = positionFromFen(fen);
  const moveInfo = [];
  if (pos) {
    for (const san of moves) {
      const move = parseSan(pos, san);
      if (!move) break;
      pos.play(move);
      const fen = makeFen(pos.toSetup());
      const lastMove = chessgroundMove(move);
      const isCheck = pos.isCheck();
      moveInfo.push({ fen, san, lastMove, isCheck });
    }
  }

  const ref = useRef<HTMLTableRowElement>(null);
  const reset = useForceUpdate();
  useLayoutEffect(() => {
    document.addEventListener("analysis-panel-scroll", reset);
    return () => {
      document.removeEventListener("analysis-panel-scroll", reset);
    };
  }, [reset]);

  useEffect(() => reset(), [open]);

  const [evalDisplay, setEvalDisplay] = useAtom(scoreTypeFamily(engine));

  return (
    <>
      <Table.Tr style={{ verticalAlign: "top" }}>
        <Table.Td width={70}>
          <ScoreBubble
            size="md"
            score={score}
            evalDisplay={evalDisplay}
            setEvalDisplay={setEvalDisplay}
          />
        </Table.Td>
        <Table.Td>
          <Flex
            direction="row"
            wrap="wrap"
            style={{
              height: open ? "100%" : 35,
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            {moveInfo.map(({ san, fen, lastMove, isCheck }, index) => (
              <BoardPopover
                position={{
                  left: ref.current?.getClientRects()[0]?.left ?? 0,
                  top: ref.current?.getClientRects()[0]?.top ?? 0,
                }}
                key={index}
                san={san}
                index={index}
                moves={moves}
                halfMoves={halfMoves}
                threat={threat}
                fen={fen}
                orientation={orientation}
                lastMove={lastMove}
                isCheck={isCheck}
              />
            ))}
          </Flex>
        </Table.Td>
        <Table.Th w={10}>
          <ActionIcon
            style={{
              transition: "transform 200ms ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
            onClick={() => setOpen(!open)}
          >
            <IconChevronDown size={16} />
          </ActionIcon>
        </Table.Th>
      </Table.Tr>
      <Table.Tr ref={ref} />
    </>
  );
}

function BoardPopover({
  san,
  lastMove,
  isCheck,
  index,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
  position,
}: {
  san: string;
  lastMove: Key[];
  isCheck: boolean;
  index: number;
  moves: string[];
  halfMoves: number;
  threat: boolean;
  fen: string;
  orientation: "white" | "black";
  position: { left: number; top: number };
}) {
  const total_moves = halfMoves + index + 1 + (threat ? 1 : 0);
  const is_white = total_moves % 2 === 1;
  const move_number = Math.ceil(total_moves / 2);
  const store = useContext(TreeStateContext)!;
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const preview = useAtomValue(previewBoardOnHoverAtom);

  const [hovering, setHovering] = useState(false);

  return (
    <>
      <Box
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {(index === 0 || is_white) &&
          `${move_number.toString()}${is_white ? "." : "..."}`}
        <MoveCell
          move={san}
          isCurrentVariation={false}
          annotations={[]}
          onContextMenu={() => undefined}
          isStart={false}
          onClick={() => {
            if (!threat) {
              makeMoves({ payload: moves.slice(0, index + 1) });
            }
          }}
        />
      </Box>
      {preview && hovering && (
        <Portal>
          <Box
            w={200}
            style={{
              top: position.top,
              left: position.left,
            }}
            pos="absolute"
          >
            <Chessground
              fen={fen}
              coordinates={false}
              viewOnly
              orientation={orientation}
              lastMove={lastMove}
              turnColor={is_white ? "black" : "white"}
              check={isCheck}
              drawable={{
                enabled: true,
                visible: true,
                defaultSnapToValidMove: true,
                eraseOnClick: true,
              }}
            />
          </Box>
        </Portal>
      )}
    </>
  );
}

export default AnalysisRow;
