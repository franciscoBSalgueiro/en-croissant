import { ActionIcon, Group, Stack, Tooltip } from "@mantine/core";
import { useLocalStorage, useToggle } from "@mantine/hooks";
import { IconSwitchVertical } from "@tabler/icons";
import { Chess, KING, Square } from "chess.js";
import { Color } from "chessground/types";
import { useContext } from "react";
import Chessground from "react-chessground";
import { formatMove, moveToKey, toDests } from "../utils/chess";
import { TreeContext } from "./BoardAnalysis";
import OpeningName from "./OpeningName";

interface ChessboardProps {
  makeMove: (move: { from: Square; to: Square; promotion?: string }) => void;
}

function Chessboard({ makeMove }: ChessboardProps) {
  const tree = useContext(TreeContext);
  const chess = new Chess(tree.fen);
  const lastMove = tree.move;
  const [showDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [showArrows] = useLocalStorage<boolean>({
    key: "show-arrows",
    defaultValue: true,
  });
  const fen = chess.fen();
  const dests = toDests(chess);
  const turn = formatMove(chess.turn());
  const [orientation, toggleOrientation] = useToggle<Color>(["white", "black"]);

  return (
    <Stack justify="center">
      <div style={{ aspectRatio: 1 }}>
        <Chessground
          style={{ justifyContent: "start" }}
          width={"100%"}
          height={"100%"}
          orientation={orientation}
          fen={fen}
          movable={{
            free: false,
            color: turn,
            dests: dests,
            showDests,
            events: {
              after: (orig, dest) => {
                if (orig === "a0" || dest === "a0") {
                  // NOTE: Idk if this can happen
                  return;
                }
                if (chess.get(orig)?.type === KING) {
                  switch (dest) {
                    case "h1":
                      dest = "g1";
                      break;
                    case "a1":
                      dest = "c1";
                      break;
                    case "h8":
                      dest = "g8";
                      break;
                    case "a8":
                      dest = "c8";
                      break;
                  }
                }
                makeMove({
                  from: orig,
                  to: dest,
                });
              },
            },
          }}
          turnColor={turn}
          check={chess.inCheck()}
          lastMove={moveToKey(lastMove)}
          // drawable={{
          //   enabled: true,
          //   visible: true,
          //   defaultSnapToValidMove: true,
          //   eraseOnClick: true,
          //   autoShapes:
          //     showArrows && engineVariations.length > 0
          //       ? engineVariations[0].map((variation, i) => {
          //           const move = variation.uciMoves[0];
          //           const { from, to } = parseUci(move);
          //           return {
          //             orig: from,
          //             dest: to,
          //             brush: i === 0 ? "paleBlue" : "paleGrey",
          //           };
          //         })
          //       : [],
          // }}
        />
      </div>

      <Group position={"apart"}>
        <OpeningName />

        <Tooltip label={"Flip Board"}>
          <ActionIcon onClick={() => toggleOrientation()}>
            <IconSwitchVertical />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Stack>
  );
}

export default Chessboard;
