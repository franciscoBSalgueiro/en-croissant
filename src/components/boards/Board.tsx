import {
  autoPromoteAtom,
  autoSaveAtom,
  currentEvalOpenAtom,
  currentTabAtom,
  deckAtomFamily,
  enableBoardScrollAtom,
  forcedEnPassantAtom,
  moveInputAtom,
  showArrowsAtom,
  showConsecutiveArrowsAtom,
  showCoordinatesAtom,
  showDestsAtom,
  snapArrowsAtom,
} from "@/atoms/atoms";
import { keyMapAtom } from "@/atoms/keybinds";
import { Chessground } from "@/chessground/Chessground";
import { chessboard } from "@/styles/Chessboard.css";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import {
  type TimeControlField,
  getMaterialDiff,
  parseTimeControl,
} from "@/utils/chess";
import {
  chessopsError,
  forceEnPassant,
  positionFromFen,
} from "@/utils/chessops";
import {
  type GameHeaders,
  type TreeNode,
  getNodeAtPath,
} from "@/utils/treeReducer";
import {
  ActionIcon,
  Box,
  Group,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBack,
  IconChevronRight,
  IconDeviceFloppy,
  IconEdit,
  IconPlus,
  IconSwitchVertical,
  IconTarget,
  IconZoomCheck,
} from "@tabler/icons-react";
import type { DrawShape } from "chessground/draw";
import {
  type NormalMove,
  type SquareName,
  makeSquare,
  parseSquare,
  parseUci,
} from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { makeSan } from "chessops/san";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Resizable } from "re-resizable";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { match } from "ts-pattern";
import ShowMaterial from "../common/ShowMaterial";
import { TreeDispatchContext } from "../common/TreeStateContext";
import { updateCardPerformance } from "../files/opening";
import { arrowColors } from "../panels/analysis/BestMoves";
import AnnotationHint from "./AnnotationHint";
import * as classes from "./Board.css";
import Clock from "./Clock";
import EvalBar from "./EvalBar";
import MoveInput from "./MoveInput";
import PromotionModal from "./PromotionModal";

const LARGE_BRUSH = 11;
const MEDIUM_BRUSH = 7.5;
const SMALL_BRUSH = 4;

interface ChessboardProps {
  dirty: boolean;
  currentNode: TreeNode;
  position: number[];
  arrows: Map<number, { pv: string[]; winChance: number }[]>;
  headers: GameHeaders;
  root: TreeNode;
  editingMode: boolean;
  toggleEditingMode: () => void;
  viewOnly?: boolean;
  disableVariations?: boolean;
  movable?: "both" | "white" | "black" | "turn" | "none";
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  saveFile?: () => void;
  addGame?: () => void;
  canTakeBack?: boolean;
  whiteTime?: number;
  blackTime?: number;
  whiteTc?: TimeControlField;
  blackTc?: TimeControlField;
  practicing?: boolean;
}

const boardSizeAtom = atomWithStorage("board-size", {
  width: 2000,
  height: 2000,
});

function Board({
  dirty,
  currentNode,
  headers,
  arrows,
  editingMode,
  toggleEditingMode,
  viewOnly,
  disableVariations,
  movable = "turn",
  boardRef,
  saveFile,
  addGame,
  canTakeBack,
  root,
  position,
  whiteTime,
  blackTime,
  whiteTc,
  blackTc,
  practicing,
}: ChessboardProps) {
  const dispatch = useContext(TreeDispatchContext);

  const [pos, error] = positionFromFen(currentNode.fen);

  const moveInput = useAtomValue(moveInputAtom);
  const showDests = useAtomValue(showDestsAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const showConsecutiveArrows = useAtomValue(showConsecutiveArrowsAtom);
  const autoPromote = useAtomValue(autoPromoteAtom);
  const forcedEP = useAtomValue(forcedEnPassantAtom);
  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const autoSave = useAtomValue(autoSaveAtom);

  let dests: Map<SquareName, SquareName[]> = pos
    ? chessgroundDests(pos)
    : new Map();
  if (forcedEP && pos) {
    dests = forceEnPassant(dests, pos);
  }
  const turn = pos?.turn || "white";
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);
  const orientation =
    movable === "white" || movable === "black"
      ? movable
      : headers.orientation || "white";
  const toggleOrientation = () =>
    dispatch({
      type: "SET_HEADERS",
      payload: {
        ...headers,
        orientation: headers.orientation === "black" ? "white" : "black",
      },
    });

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.SWAP_ORIENTATION.keys, () => toggleOrientation());
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const [evalOpen, setEvalOpen] = useAtom(currentEvalOpenAtom);

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      file: currentTab?.file?.path || "",
      game: currentTab?.gameNumber || 0,
    }),
  );

  async function makeMove(move: NormalMove) {
    if (!pos) return;
    const san = makeSan(pos, move);
    if (practicing) {
      const c = deck.positions.find((c) => c.fen === currentNode.fen);
      if (!c) {
        return;
      }

      let isRecalled = true;
      if (san !== c?.answer) {
        isRecalled = false;
      }
      const i = deck.positions.indexOf(c);

      if (!isRecalled) {
        notifications.show({
          title: "Incorrect",
          message: `The correct move was ${c.answer}`,
          color: "red",
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        dispatch({
          type: "GO_TO_NEXT",
        });
      } else {
        dispatch({
          type: "MAKE_MOVE",
          payload: move,
        });
        setPendingMove(null);
      }

      updateCardPerformance(setDeck, i, c.card, isRecalled ? 4 : 1);
    } else {
      dispatch({
        type: "MAKE_MOVE",
        payload: move,
        clock: pos.turn === "white" ? whiteTime : blackTime,
      });
      setPendingMove(null);
    }
  }

  let shapes: DrawShape[] = [];
  if (showArrows && evalOpen && arrows.size > 0 && pos) {
    const entries = Array.from(arrows.entries()).sort((a, b) => a[0] - b[0]);
    for (const [i, moves] of entries) {
      if (i < 4) {
        const bestWinChance = moves[0].winChance;
        for (const [j, { pv, winChance }] of moves.entries()) {
          const posClone = pos.clone();
          let prevSquare = null;
          for (const [ii, uci] of pv.entries()) {
            const m = parseUci(uci)! as NormalMove;

            posClone.play(m);
            const from = makeSquare(m.from)!;
            const to = makeSquare(m.to)!;
            if (prevSquare === null) {
              prevSquare = from;
            }
            const brushSize = match(bestWinChance - winChance)
              .when(
                (d) => d < 2.5,
                () => LARGE_BRUSH,
              )
              .when(
                (d) => d < 5,
                () => MEDIUM_BRUSH,
              )
              .otherwise(() => SMALL_BRUSH);

            if (
              ii === 0 ||
              (showConsecutiveArrows && j === 0 && ii % 2 === 0)
            ) {
              if (
                ii < 5 && // max 3 arrows
                !shapes.find((s) => s.orig === from && s.dest === to) &&
                prevSquare === from
              ) {
                shapes.push({
                  orig: from,
                  dest: to,
                  brush: j === 0 ? arrowColors[i].strong : arrowColors[i].pale,
                  modifiers: {
                    lineWidth: brushSize,
                  },
                });
                prevSquare = to;
              } else {
                break;
              }
            }
          }
        }
      }
    }
  }

  if (currentNode.shapes.length > 0) {
    shapes = shapes.concat(currentNode.shapes);
  }

  function changeTabType() {
    setCurrentTab((t) => {
      return {
        ...t,
        type: t.type === "analysis" ? "play" : "analysis",
      };
    });
  }

  const controls = useMemo(
    () => (
      <ActionIcon.Group>
        {canTakeBack && (
          <Tooltip label="Take Back">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => dispatch({ type: "DELETE_MOVE" })}
            >
              <IconArrowBack />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip
          label={
            currentTab?.type === "analysis" ? "Play from here" : "Analyze game"
          }
        >
          <ActionIcon variant="default" size="lg" onClick={changeTabType}>
            {currentTab?.type === "analysis" ? (
              <IconTarget size="1.3rem" />
            ) : (
              <IconZoomCheck size="1.3rem" />
            )}
          </ActionIcon>
        </Tooltip>
        {!disableVariations && (
          <Tooltip label="Edit Position">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => toggleEditingMode()}
            >
              <IconEdit size="1.3rem" />
            </ActionIcon>
          </Tooltip>
        )}
        {saveFile && (
          <Tooltip label={`Save PGN (${keyMap.SAVE_FILE.keys})`}>
            <ActionIcon
              onClick={() => saveFile()}
              size="lg"
              variant={dirty && !autoSave ? "outline" : "default"}
            >
              <IconDeviceFloppy size="1.3rem" />
            </ActionIcon>
          </Tooltip>
        )}
        {addGame && currentTab?.file && (
          <Tooltip label="Add Game">
            <ActionIcon variant="default" size="lg" onClick={() => addGame()}>
              <IconPlus size="1.3rem" />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={`Flip Board (${keyMap.SWAP_ORIENTATION.keys})`}>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => toggleOrientation()}
          >
            <IconSwitchVertical size="1.3rem" />
          </ActionIcon>
        </Tooltip>
      </ActionIcon.Group>
    ),
    [
      autoSave,
      dirty,
      keyMap,
      currentTab,
      disableVariations,
      saveFile,
      canTakeBack,
      toggleEditingMode,
      toggleOrientation,
      addGame,
    ],
  );
  const materialDiff = getMaterialDiff(currentNode.fen);
  const practiceLock =
    !!practicing && !deck.positions.find((c) => c.fen === currentNode.fen);

  const movableColor: "white" | "black" | "both" | undefined = useMemo(() => {
    return practiceLock
      ? undefined
      : editingMode
        ? "both"
        : match(movable)
            .with("white", () => "white" as const)
            .with("black", () => "black" as const)
            .with("turn", () => turn)
            .with("both", () => "both" as const)
            .with("none", () => undefined)
            .exhaustive();
  }, [practiceLock, editingMode, movable, turn]);

  const theme = useMantineTheme();
  const color = ANNOTATION_INFO[currentNode.annotations[0]]?.color || "gray";
  const lightColor = theme.colors[color][6];
  const darkColor = theme.colors[color][8];

  const timeControl = headers.time_control
    ? parseTimeControl(headers.time_control)
    : null;
  let { whiteSeconds, blackSeconds } = match(pos?.turn)
    .with("white", () => ({
      whiteSeconds: getNodeAtPath(root, position.slice(0, -1))?.clock,
      blackSeconds: currentNode.clock,
    }))
    .with("black", () => ({
      whiteSeconds: currentNode.clock,
      blackSeconds: getNodeAtPath(root, position.slice(0, -1))?.clock,
    }))
    .otherwise(() => {
      return {
        whiteSeconds: undefined,
        blackSeconds: undefined,
      };
    });
  if (position.length <= 1 && timeControl) {
    if (timeControl.length > 0) {
      const seconds = timeControl[0].seconds / 1000;
      if (!whiteSeconds) {
        whiteSeconds = seconds;
      }
      if (!blackSeconds) {
        blackSeconds = seconds;
      }
    }
  }
  if (whiteTime) {
    whiteSeconds = whiteTime / 1000;
  }
  if (blackTime) {
    blackSeconds = blackTime / 1000;
  }

  function calculateProgress(clock?: number, tc?: TimeControlField) {
    if (!clock) {
      return 0;
    }
    if (tc) {
      return clock / (tc.seconds / 1000);
    }
    if (timeControl) {
      return clock / (timeControl[0].seconds / 1000);
    }
    if (root.children.length > 0 && root.children[0].clock) {
      return clock / root.children[0].clock;
    }
    return 0;
  }

  const hasClock =
    whiteTime !== undefined ||
    blackTime !== undefined ||
    headers.time_control !== undefined ||
    whiteTc !== undefined ||
    blackTc !== undefined;

  const topClock = orientation === "black" ? whiteSeconds : blackSeconds;
  const topTc = orientation === "black" ? whiteTc : blackTc;
  const topProgress = calculateProgress(topClock, topTc);

  const bottomClock = orientation === "black" ? blackSeconds : whiteSeconds;
  const bottomTc = orientation === "black" ? blackTc : whiteTc;
  const bottomProgress = calculateProgress(bottomClock, bottomTc);

  const [boardFen, setBoardFen] = useState<string | null>(null);
  const [enableBoardScroll] = useAtom(enableBoardScrollAtom);
  const [snapArrows] = useAtom(snapArrowsAtom);

  useEffect(() => {
    if (editingMode && boardFen && boardFen !== currentNode.fen) {
      dispatch({
        type: "SET_FEN",
        payload: boardFen,
      });
    }
  }, [boardFen, editingMode, dispatch]);

  useHotkeys(keyMap.TOGGLE_EVAL_BAR.keys, () => setEvalOpen((e) => !e));

  const square = match(currentNode)
    .with({ san: "O-O" }, ({ halfMoves }) =>
      parseSquare(halfMoves % 2 === 1 ? "g1" : "g8"),
    )
    .with({ san: "O-O-O" }, ({ halfMoves }) =>
      parseSquare(halfMoves % 2 === 1 ? "c1" : "c8"),
    )
    .otherwise((node) => node.move?.to);

  const lastMove =
    currentNode.move && square !== undefined
      ? [chessgroundMove(currentNode.move)[0], makeSquare(square)!]
      : undefined;

  const {
    ref: parentRef,
    width: parentWidth,
    height: parentHeight,
  } = useElementSize();

  const [size, setSize] = useAtom(boardSizeAtom);
  const boardSize = Math.min(size.width, parentWidth, parentHeight);

  return (
    <>
      <Box className={classes.container}>
        <Box className={classes.board} ref={parentRef}>
          {currentNode.annotations.length > 0 &&
            currentNode.move &&
            square !== undefined && (
              <Box
                style={{
                  width: boardSize,
                  height: boardSize,
                }}
                pos="absolute"
              >
                <AnnotationHint
                  orientation={orientation}
                  square={square}
                  annotation={currentNode.annotations[0]}
                />
              </Box>
            )}
          <Box
            style={
              isBasicAnnotation(currentNode.annotations[0])
                ? {
                    "--light-color": lightColor,
                    "--dark-color": darkColor,
                  }
                : undefined
            }
            className={chessboard}
            ref={boardRef}
            onWheel={(e) => {
              if (enableBoardScroll) {
                if (e.deltaY > 0) {
                  dispatch({
                    type: "GO_TO_NEXT",
                  });
                } else {
                  dispatch({
                    type: "GO_TO_PREVIOUS",
                  });
                }
              }
            }}
          >
            <PromotionModal
              pendingMove={pendingMove}
              cancelMove={() => setPendingMove(null)}
              confirmMove={(p) => {
                if (pendingMove) {
                  makeMove({
                    from: pendingMove.from,
                    to: pendingMove.to,
                    promotion: p,
                  });
                }
              }}
              turn={turn}
              orientation={orientation}
            />
            <Resizable
              lockAspectRatio={1}
              size={size}
              onResizeStop={(e, direction, ref, d) => {
                setSize({
                  width: boardSize + d.width,
                  height: boardSize + d.height,
                });
              }}
              maxHeight={Math.min(parentWidth, parentHeight)}
              maxWidth={Math.min(parentWidth, parentHeight)}
            >
              <Chessground
                setBoardFen={setBoardFen}
                orientation={orientation}
                fen={currentNode.fen}
                animation={{ enabled: !editingMode }}
                coordinates={showCoordinates}
                movable={{
                  free: editingMode,
                  color: movableColor,
                  dests:
                    editingMode || viewOnly
                      ? undefined
                      : disableVariations && currentNode.children.length > 0
                        ? undefined
                        : dests,
                  showDests,
                  events: {
                    after: (orig, dest, metadata) => {
                      if (!editingMode) {
                        const from = parseSquare(orig)!;
                        const to = parseSquare(dest)!;

                        if (pos) {
                          if (
                            pos.board.get(from)?.role === "pawn" &&
                            ((dest[1] === "8" && turn === "white") ||
                              (dest[1] === "1" && turn === "black"))
                          ) {
                            if (autoPromote && !metadata.ctrlKey) {
                              makeMove({
                                from,
                                to,
                                promotion: "queen",
                              });
                            } else {
                              setPendingMove({
                                from,
                                to,
                              });
                            }
                          } else {
                            makeMove({
                              from,
                              to,
                            });
                          }
                        }
                      }
                    },
                  },
                }}
                turnColor={turn}
                check={pos?.isCheck()}
                lastMove={editingMode ? undefined : lastMove}
                premovable={{
                  enabled: false,
                }}
                draggable={{
                  deleteOnDropOff: editingMode,
                }}
                drawable={{
                  enabled: true,
                  visible: true,
                  defaultSnapToValidMove: snapArrows,
                  autoShapes: shapes,
                  onChange: (shapes) => {
                    dispatch({
                      type: "SET_SHAPES",
                      payload: shapes,
                    });
                  },
                }}
              />
            </Resizable>
          </Box>
        </Box>
        <Box className={classes.top}>
          {materialDiff && (
            <Group pb="0.2rem">
              {hasClock && (
                <Clock
                  clock={topClock}
                  color={orientation === "black" ? "white" : "black"}
                  progress={topProgress}
                  turn={turn}
                />
              )}
              <ShowMaterial
                diff={materialDiff.diff}
                pieces={materialDiff.pieces}
                color={orientation === "white" ? "black" : "white"}
              />
            </Group>
          )}
        </Box>
        <Box className={classes.bottom}>
          <Group justify="space-between">
            {materialDiff && (
              <Group>
                {hasClock && (
                  <Clock
                    clock={bottomClock}
                    color={orientation}
                    progress={bottomProgress}
                    turn={turn}
                  />
                )}
                <ShowMaterial
                  diff={materialDiff.diff}
                  pieces={materialDiff.pieces}
                  color={orientation}
                />
              </Group>
            )}

            {error && (
              <Text ta="center" c="red">
                {chessopsError(error)}
              </Text>
            )}

            {moveInput && <MoveInput currentNode={currentNode} />}

            {controls}
          </Group>
        </Box>
        <Box className={classes.evalStyle}>
          {!evalOpen && (
            <ActionIcon h="100%" size="1rem" onClick={() => setEvalOpen(true)}>
              <IconChevronRight />
            </ActionIcon>
          )}
          {evalOpen && (
            <Box onClick={() => setEvalOpen(false)} h="100%">
              <EvalBar score={currentNode.score} orientation={orientation} />
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

export default memo(Board);
