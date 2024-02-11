import { previewBoardOnHoverAtom } from "@/atoms/atoms";
import { Score } from "@/bindings";
import { Chessground } from "@/chessground/Chessground";
import MoveCell from "@/components/boards/MoveCell";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { positionFromFen } from "@/utils/chessops";
import { ActionIcon, Box, Flex, Popover, Table } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { useAtomValue } from "jotai";
import { useContext, useState } from "react";
import React from "react";
import ScoreBubble from "./ScoreBubble";

function AnalysisRow({
  score,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
}: {
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
      moveInfo.push({ fen, san });
    }
  }

  return (
    <Table.Tr style={{ verticalAlign: "top" }}>
      <Table.Td width={70}>
        <ScoreBubble size="md" score={score} />
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
          {moveInfo.map(({ san, fen }, index) => (
            <BoardPopover
              san={san}
              index={index}
              moves={moves}
              halfMoves={halfMoves}
              threat={threat}
              fen={fen}
              orientation={orientation}
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
  );
}

function BoardPopover({
  san,
  index,
  moves,
  halfMoves,
  threat,
  fen,
  orientation,
}: {
  san: string;
  index: number;
  moves: string[];
  halfMoves: number;
  threat: boolean;
  fen: string;
  orientation: "white" | "black";
}) {
  const [opened, { close, open }] = useDisclosure(false);
  const total_moves = halfMoves + index + 1 + (threat ? 1 : 0);
  const is_white = total_moves % 2 === 1;
  const move_number = Math.ceil(total_moves / 2);
  const dispatch = useContext(TreeDispatchContext);
  const preview = useAtomValue(previewBoardOnHoverAtom);

  return (
    <Popover
      width={230}
      styles={{
        dropdown: {
          padding: 0,
          backgroundColor: "transparent",
          border: "none",
        },
      }}
      opened={preview && opened}
    >
      <Popover.Target>
        <Box onMouseEnter={open} onMouseLeave={close}>
          {(index === 0 || is_white) &&
            `${move_number.toString()}${is_white ? "." : "..."}`}
          <MoveCell
            move={san}
            isCurrentVariation={false}
            annotation={""}
            onContextMenu={() => undefined}
            isStart={false}
            onClick={() => {
              if (!threat) {
                dispatch({
                  type: "MAKE_MOVES",
                  payload: moves.slice(0, index + 1),
                });
              }
            }}
          />
        </Box>
      </Popover.Target>
      <Popover.Dropdown
        style={{ pointerEvents: "none", transitionDuration: "0ms" }}
      >
        <Chessground
          fen={fen}
          coordinates={false}
          viewOnly
          orientation={orientation}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

export default AnalysisRow;
