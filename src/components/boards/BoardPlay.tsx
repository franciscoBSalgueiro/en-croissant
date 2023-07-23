import {
  ActionIcon,
  Alert,
  Box,
  createStyles,
  Group,
  Input,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  useClickOutside,
  useHotkeys,
  useToggle,
  useViewportSize,
} from "@mantine/hooks";
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconPlus,
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
import {
  handleMove,
  moveToKey,
  parseKeyboardMove,
  parseUci,
  toDests,
} from "@/utils/chess";
import { Outcome } from "@/utils/db";
import { formatMove } from "@/utils/format";
import { getBoardSize, invoke } from "@/utils/misc";
import { GameHeaders, TreeNode } from "@/utils/treeReducer";
import Piece from "../common/Piece";
import { TreeDispatchContext } from "../common/TreeStateContext";
import EvalBar from "./EvalBar";
import { formatScore } from "@/utils/score";
import { useAtomValue } from "jotai";
import {
  autoPromoteAtom,
  currentTabAtom,
  forcedEnPassantAtom,
  moveInputAtom,
  showArrowsAtom,
  showDestsAtom,
} from "@/atoms/atoms";

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
  saveFile?: () => void;
  addGame?: () => void;
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
  saveFile,
  addGame,
}: ChessboardProps) {
  const dispatch = useContext(TreeDispatchContext);
  let chess: Chess | null;
  let error: string | null = null;
  try {
    chess = new Chess(currentNode.fen);
  } catch (e) {
    chess = null;
    if (e instanceof Error) {
      error = e.message;
    }
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

  const moveInput = useAtomValue(moveInputAtom);
  const showDests = useAtomValue(showDestsAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const autoPromote = useAtomValue(autoPromoteAtom);
  const forcedEP = useAtomValue(forcedEnPassantAtom);

  const activeTab = useAtomValue(currentTabAtom);

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
        {saveFile && (
          <Tooltip label={"Save PGN"}>
            <ActionIcon onClick={() => saveFile()}>
              <IconDeviceFloppy />
            </ActionIcon>
          </Tooltip>
        )}
        {addGame && activeTab?.file && (
          <Tooltip label={"Add Game"}>
            <ActionIcon onClick={() => addGame()}>
              <IconPlus />
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
    [disableVariations, saveFile, toggleEditingMode, toggleOrientation, addGame]
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
          <PromotionModal
            pendingMove={pendingMove}
            setPendingMove={setPendingMove}
            turn={turn}
          />
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
                      const newDest = handleMove(chess, orig, dest);
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
          <Group>
            {moveInput && <MoveInput currentNode={currentNode} />}
            {currentNode.score && <Text>{formatScore(currentNode.score)}</Text>}
          </Group>

          {controls}
        </Group>
      </Stack>
    </>
  );
}

function MoveInput({ currentNode }: { currentNode: TreeNode }) {
  const dispatch = useContext(TreeDispatchContext);
  const [move, setMove] = useState("");
  const [error, setError] = useState("");

  return (
    <Input
      size="sm"
      w={80}
      onChange={(e) => {
        setMove(e.currentTarget.value);
        setError("");
      }}
      error={error}
      value={move}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const m = move.trim();
          if (m.length > 0) {
            const parsed = parseKeyboardMove(m, currentNode.fen);
            console.log(parsed);
            if (parsed) {
              dispatch({
                type: "MAKE_MOVE",
                payload: parsed,
              });
              setMove("");
            } else {
              setError("Invalid move");
            }
          }
        }
      }}
    />
  );
}

const fileToNumber: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
};

const PromotionModal = memo(function PromotionModal({
  pendingMove,
  setPendingMove,
  turn,
}: {
  pendingMove: { from: Square; to: Square } | null;
  setPendingMove: (move: { from: Square; to: Square } | null) => void;
  turn?: Color;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const file = fileToNumber[pendingMove?.to[0] ?? "a"];
  const rank = parseInt(pendingMove?.to[1] ?? "1");
  const ref = useClickOutside(() => setPendingMove(null));

  return (
    <>
      {pendingMove && (
        <>
          <div
            style={{
              position: "absolute",
              zIndex: 100,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <div
            ref={ref}
            style={{
              position: "absolute",
              zIndex: 100,
              left: `${(file - 1) * 12.5}%`,
              top: rank === 1 ? "50%" : "0%",
              background: "rgba(255,255,255,0.8)",
            }}
          >
            <Stack spacing={0}>
              {promotionPieces.map((p) => (
                <ActionIcon
                  key={p}
                  w="100%"
                  h="100%"
                  pos="relative"
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
            </Stack>
          </div>
        </>
      )}
    </>
  );
});

export default memo(BoardPlay);
