import { Flex, ActionIcon, ChevronIcon } from "@mantine/core";
import { useState, useContext } from "react";
import { Annotation } from "../../../utils/chess";
import { Score } from "../../../utils/score";
import MoveCell from "../../boards/MoveCell";
import { TreeDispatchContext } from "../../common/TreeStateContext";
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
    <tr style={{ verticalAlign: "top" }}>
      <td>
        <ScoreBubble score={score} />
      </td>
      <td>
        <Flex
          direction="row"
          wrap="wrap"
          sx={{
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
              <>
                {(index === 0 || is_white) && (
                  <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>
                )}
                <MoveCell
                  key={index + move}
                  move={move}
                  isCurrentVariation={false}
                  annotation={Annotation.None}
                  onContextMenu={() => undefined}
                  onClick={() => {
                    if (!threat) {
                      dispatch({
                        type: "MAKE_MOVES",
                        payload: moves.slice(0, index + 1),
                      });
                    }
                  }}
                />
              </>
            );
          })}
        </Flex>
      </td>
      <td>
        <ActionIcon
          style={{
            transition: "transform 200ms ease",
            transform: open ? `rotate(180deg)` : "none",
          }}
          onClick={() => setOpen(!open)}
        >
          <ChevronIcon />
        </ActionIcon>
      </td>
    </tr>
  );
}

export default AnalysisRow;
