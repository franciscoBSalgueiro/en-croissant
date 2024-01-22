import { Score } from "@/bindings";
import MoveCell from "@/components/boards/MoveCell";
import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { ActionIcon, Flex, Table, rem } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useContext, useState } from "react";
import React from "react";
import ScoreBubble from "./ScoreBubble";

function AnalysisRow({
  score,
  moves,
  halfMoves,
  threat,
}: {
  score: Score;
  moves: string[];
  halfMoves: number;
  threat: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const dispatch = useContext(TreeDispatchContext);

  if (!open) {
    moves = moves.slice(0, 12);
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
          {moves.map((move, index) => {
            const total_moves = halfMoves + index + 1 + (threat ? 1 : 0);
            const is_white = total_moves % 2 === 1;
            const move_number = Math.ceil(total_moves / 2);
            return (
              <React.Fragment key={index + move}>
                {(index === 0 || is_white) &&
                  `${move_number.toString()}${is_white ? "." : "..."}`}
                <MoveCell
                  move={move}
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
              </React.Fragment>
            );
          })}
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

export default AnalysisRow;
