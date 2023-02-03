import {
  ActionIcon,
  AspectRatio,
  Box,
  Card,
  createStyles,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Tooltip
} from "@mantine/core";
import { useHotkeys, useLocalStorage, useToggle } from "@mantine/hooks";
import {
  IconChessBishop,
  IconChessKnight,
  IconChessQueen,
  IconChessRook,
  IconEdit,
  IconSwitchVertical
} from "@tabler/icons";
import { BISHOP, Chess, KNIGHT, QUEEN, ROOK, Square } from "chess.js";
import { Color } from "chessground/types";
import { useContext, useState } from "react";
import Chessground from "react-chessground";
import {
  formatMove,
  handleMove,
  moveToKey,
  parseUci,
  toDests
} from "../../utils/chess";
import { CompleteGame, Outcome } from "../../utils/db";
import TreeContext from "../common/TreeContext";
import OpeningName from "./OpeningName";

const useStyles = createStyles((theme) => ({
  chessboard: {
    aspectRatio: "1 / 1",
    position: "relative",
    zIndex: 1,
  },
}));

interface ChessboardProps {
  arrows: string[];
  makeMove: (move: { from: Square; to: Square; promotion?: string }) => void;
  editingMode: boolean;
  toggleEditingMode: () => void;
  viewOnly?: boolean;
  disableVariations?: boolean;
  setCompleteGame: React.Dispatch<React.SetStateAction<CompleteGame>>;
  completeGame: CompleteGame;
}

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

function BoardPlay({
  arrows,
  makeMove,
  editingMode,
  toggleEditingMode,
  viewOnly,
  disableVariations,
  setCompleteGame,
  completeGame,
}: ChessboardProps) {
  const tree = useContext(TreeContext);
  const chess = new Chess(tree.fen);
  if (chess.isCheckmate() && completeGame.game.outcome === Outcome.Unknown) {
    setCompleteGame((prev) => ({
      ...prev,
      game: {
        ...prev.game,
        outcome: chess.turn() === "w" ? Outcome.BlackWin : Outcome.WhiteWin,
      },
    }));
  }

  const lastMove = tree.move;
  const [showDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [showArrows] = useLocalStorage<boolean>({
    key: "show-arrows",
    defaultValue: true,
  });
  const [autoPromote] = useLocalStorage<boolean>({
    key: "auto-promote",
    defaultValue: true,
  });
  const [forcedEP] = useLocalStorage<boolean>({
    key: "forced-en-passant",
    defaultValue: false,
  });
  const fen = chess.fen();
  const dests = toDests(chess, forcedEP);
  const turn = formatMove(chess.turn());
  const [pendingMove, setPendingMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [orientation, toggleOrientation] = useToggle<Color>(["white", "black"]);
  const { classes } = useStyles();

  useHotkeys([["f", () => toggleOrientation()]]);

  return (
    <Stack justify="center">
      {editingMode && (
        <Card shadow="sm">
          <Group position="center">
            <p>HORSE</p>
            <p>HORSE</p>
            <p>HORSE</p>
            <p>HORSE</p>
          </Group>
        </Card>
      )}

      <div className={classes.chessboard}>
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
                      makeMove({
                        from: pendingMove!.from,
                        to: pendingMove!.to,
                        promotion: p.piece,
                      });
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
          style={{ justifyContent: "start" }}
          width={"100%"}
          height={"100%"}
          orientation={orientation}
          fen={fen}
          coordinates={false}
          movable={{
            free: editingMode,
            color: editingMode ? "both" : turn,
            dests:
              editingMode || viewOnly
                ? undefined
                : disableVariations && tree.children.length > 0
                ? undefined
                : dests,
            showDests,
            events: {
              after: (orig, dest, metadata) => {
                if (editingMode) {
                  makeMove({
                    from: orig as Square,
                    to: dest as Square,
                  });
                } else {
                  let newDest = handleMove(chess, orig, dest)!;
                  // handle promotions
                  if (
                    chess.get(orig as Square).type === "p" &&
                    ((newDest[1] === "8" && turn === "white") ||
                      (newDest[1] === "1" && turn === "black"))
                  ) {
                    if (autoPromote && !metadata.ctrlKey) {
                      makeMove({
                        from: orig as Square,
                        to: newDest,
                        promotion: QUEEN,
                      });
                    } else {
                      setPendingMove({ from: orig as Square, to: newDest });
                    }
                  } else {
                    makeMove({
                      from: orig as Square,
                      to: newDest,
                    });
                  }
                }
              },
            },
          }}
          turnColor={turn}
          check={chess.inCheck()}
          lastMove={moveToKey(lastMove)}
          drawable={{
            enabled: true,
            visible: true,
            defaultSnapToValidMove: true,
            eraseOnClick: true,
            autoShapes:
              showArrows && arrows.length > 0
                ? arrows.map((move, i) => {
                    const { from, to } = parseUci(move);
                    return {
                      orig: from,
                      dest: to,
                      brush: i === 0 ? "paleBlue" : "paleGrey",
                    };
                  })
                : [],
          }}
        />
      </div>

      <Group position={"apart"}>
        <OpeningName />

        <Group>
          {!disableVariations && (
            <Tooltip label={"Edit Position"}>
              <ActionIcon onClick={() => toggleEditingMode()}>
                <IconEdit />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={"Flip Board"}>
            <ActionIcon onClick={() => toggleOrientation()}>
              <IconSwitchVertical />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Stack>
  );
}

export default BoardPlay;
