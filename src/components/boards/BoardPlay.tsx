import {
  ActionIcon,
  Alert,
  Box,
  Card,
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
import { memo, useContext, useRef, useState } from "react";
import Chessground from "react-chessground";
import {
  handleMove,
  moveToKey,
  parseUci,
  toDests,
} from "../../utils/chess";
import { Outcome } from "../../utils/db";
import { formatMove, formatScore } from "../../utils/format";
import { getBoardSize } from "../../utils/misc";
import { GameHeaders, TreeNode } from "../../utils/treeReducer";
import Piece from "../common/Piece";
import { TreeDispatchContext } from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";
import EvalBar from "./EvalBar";

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
  // addPiece: (square: Square, piece: PieceSymbol, color: "w" | "b") => void;
  editingMode: boolean;
  toggleEditingMode: () => void;
  viewOnly?: boolean;
  disableVariations?: boolean;
  side?: Color;
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
  const boardRef = useRef(null);
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

  const pieces = ["p", "n", "b", "r", "q", "k"] as const;
  const colors = ["w", "b"] as const;
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
        {editingMode && (
          <Card shadow="md" style={{ overflow: "visible" }}>
            <FenInput />
            <SimpleGrid cols={6}>
              {colors.map((color) => {
                return pieces.map((piece) => {
                  return (
                    <Piece boardRef={boardRef} piece={piece} color={color} />
                  );
                });
              })}
            </SimpleGrid>
          </Card>
        )}
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
                <Piece piece={p} color={turn === "white" ? "w" : "b"} />
              </ActionIcon>
            ))}
          </SimpleGrid>
        </Modal>

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
                    dispatch({
                      type: "MAKE_MOVE",
                      payload: {
                        from: orig as Square,
                        to: dest as Square,
                      },
                    });
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
    </>
  );
}

export default memo(BoardPlay);
