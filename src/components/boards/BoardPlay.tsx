import {
  ActionIcon,
  Alert,
  Box,
  createStyles,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  useHotkeys,
  useLocalStorage,
  useToggle,
  useViewportSize,
} from "@mantine/hooks";
import {
  IconAlertCircle,
  IconEdit,
  IconSwitchVertical,
} from "@tabler/icons-react";
import {
  BISHOP,
  Chess,
  KNIGHT,
  PieceSymbol,
  QUEEN,
  ROOK,
  Square,
} from "chess.js";
import { DrawShape } from "chessground/draw";
import { Color } from "chessground/types";
import { memo, useContext, useMemo, useState } from "react";
import Chessground from "react-chessground";
import { handleMove, moveToKey, parseUci, toDests } from "../../utils/chess";
import { Outcome } from "../../utils/db";
import { formatMove } from "../../utils/format";
import { getBoardSize, invoke } from "../../utils/misc";
import { GameHeaders, TreeNode } from "../../utils/treeReducer";
import Piece from "../common/Piece";
import { TreeDispatchContext } from "../common/TreeStateContext";
import EvalBar from "./EvalBar";
import { formatScore } from "../../utils/score";

const useStyles = createStyles(() => ({
  chessboard: {
    position: "relative",
    marginRight: "auto",
    marginLeft: "auto",
    zIndex: 1,
  },
}));

interface ChessboardProps {
  currentNode: TreeNode;
  arrows: string[];
  headers: GameHeaders;
  editingMode: boolean;
  toggleEditingMode: () => void;
  viewOnly?: boolean;
  disableVariations?: boolean;
  side?: Color;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
}

const promotionPieces: PieceSymbol[] = [QUEEN, ROOK, KNIGHT, BISHOP];

function BoardPlay({
  currentNode,
  headers,
  arrows,
  editingMode,
  toggleEditingMode,
  viewOnly,
  disableVariations,
  side,
  boardRef,
}: ChessboardProps) {
  const dispatch = useContext(TreeDispatchContext);
  let chess: Chess | null;
  let error: string | null = null;
  try {
    chess = new Chess(currentNode.fen);
  } catch (e: any) {
    chess = null;
    error = e.message;
  }

  if (
    chess !== null &&
    chess.isGameOver() &&
    headers.result === Outcome.Unknown
  ) {
    let newOutcome = Outcome.Draw;
    if (chess.isCheckmate()) {
      newOutcome = chess.turn() === "w" ? Outcome.BlackWin : Outcome.WhiteWin;
    }
    dispatch({
      type: "SET_HEADERS",
      payload: {
        ...headers,
        result: newOutcome,
      },
    });
  }

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
  const dests = toDests(chess, forcedEP);
  const turn = chess ? formatMove(chess.turn()) : undefined;
  const [pendingMove, setPendingMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [orientation, toggleOrientation] = useToggle<Color>(["white", "black"]);
  const { classes } = useStyles();
  const { height, width } = useViewportSize();

  const boardSize = getBoardSize(height, width);

  useHotkeys([["f", () => toggleOrientation()]]);

  let shapes: DrawShape[] =
    showArrows && arrows.length > 0
      ? arrows.map((move, i) => {
          const { from, to } = parseUci(move);
          return {
            orig: from,
            dest: to,
            brush: i === 0 ? "paleBlue" : "paleGrey",
          };
        })
      : [];

  if (currentNode.shapes.length > 0) {
    shapes = shapes.concat(currentNode.shapes);
  }

  const controls = useMemo(
    () => (
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
    ),
    [disableVariations, toggleEditingMode, toggleOrientation]
  );

  return (
    <>
      {width > 800 && (
        <EvalBar
          score={currentNode.score}
          boardSize={boardSize}
          orientation={orientation}
        />
      )}

      <Stack justify="center">
        <PromotionModal
          pendingMove={pendingMove}
          setPendingMove={setPendingMove}
          turn={turn}
        />
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Invalid position"
            color="red"
          >
            {error}
          </Alert>
        )}
        <Box className={classes.chessboard} ref={boardRef}>
          <Chessground
            width={boardSize}
            height={boardSize}
            orientation={side ?? orientation}
            fen={currentNode.fen}
            coordinates={false}
            movable={{
              free: editingMode,
              color: editingMode ? "both" : turn,
              dests:
                editingMode || viewOnly
                  ? undefined
                  : disableVariations && currentNode.children.length > 0
                  ? undefined
                  : dests,
              showDests,
              events: {
                after: (orig, dest, metadata) => {
                  if (editingMode) {
                    invoke<string>("make_move", {
                      fen: currentNode.fen,
                      from: orig,
                      to: dest,
                    }).then((newFen) => {
                      dispatch({
                        type: "SET_FEN",
                        payload: newFen,
                      });
                    });
                    // dispatch({
                    //   type: "MAKE_MOVE",
                    //   payload: {
                    //     from: orig as Square,
                    //     to: dest as Square,
                    //   },
                    // });
                  } else {
                    if (chess) {
                      let newDest = handleMove(chess, orig, dest)!;
                      if (
                        chess.get(orig as Square).type === "p" &&
                        ((newDest[1] === "8" && turn === "white") ||
                          (newDest[1] === "1" && turn === "black"))
                      ) {
                        if (autoPromote && !metadata.ctrlKey) {
                          dispatch({
                            type: "MAKE_MOVE",
                            payload: {
                              from: orig as Square,
                              to: newDest,
                              promotion: QUEEN,
                            },
                          });
                        } else {
                          setPendingMove({ from: orig as Square, to: newDest });
                        }
                      } else {
                        dispatch({
                          type: "MAKE_MOVE",
                          payload: {
                            from: orig as Square,
                            to: newDest,
                          },
                        });
                      }
                    }
                  }
                },
              },
            }}
            turnColor={turn}
            check={chess?.inCheck()}
            lastMove={moveToKey(currentNode.move)}
            drawable={{
              enabled: true,
              visible: true,
              defaultSnapToValidMove: true,
              eraseOnClick: true,
              autoShapes: shapes,
              onChange: (shapes) => {
                dispatch({
                  type: "SET_SHAPES",
                  payload: shapes,
                });
              },
            }}
          />
        </Box>

        <Group position={"apart"} h={20}>
          {currentNode.score ? (
            <Text>{formatScore(currentNode.score)}</Text>
          ) : (
            <div />
          )}

          {controls}
        </Group>
      </Stack>
    </>
  );
}

const PromotionModal = memo(
  ({
    pendingMove,
    setPendingMove,
    turn,
  }: {
    pendingMove: { from: Square; to: Square } | null;
    setPendingMove: (move: { from: Square; to: Square } | null) => void;
    turn?: Color;
  }) => {
    const dispatch = useContext(TreeDispatchContext);
    return (
      <Modal
        opened={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        withCloseButton={false}
        size={375}
      >
        <SimpleGrid cols={2}>
          {promotionPieces.map((p) => (
            <ActionIcon
              key={p}
              sx={{ width: "100%", height: "100%", position: "relative" }}
              onClick={() => {
                dispatch({
                  type: "MAKE_MOVE",
                  payload: {
                    from: pendingMove!.from,
                    to: pendingMove!.to,
                    promotion: p,
                  },
                });
                setPendingMove(null);
              }}
            >
              <Piece
                piece={{
                  type: p,
                  color: turn === "white" ? "w" : "b",
                }}
              />
            </ActionIcon>
          ))}
        </SimpleGrid>
      </Modal>
    );
  }
);

export default memo(BoardPlay);
