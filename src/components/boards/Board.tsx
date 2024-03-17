import {
  autoPromoteAtom,
  autoSaveAtom,
  currentEvalOpenAtom,
  currentInvisibleAtom,
  currentTabAtom,
  deckAtomFamily,
  enableBoardScrollAtom,
  fontSizeAtom,
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
import {
  ANNOTATION_INFO,
  type Annotation,
  type TimeControlField,
  getMaterialDiff,
  isBasicAnnotation,
  parseKeyboardMove,
  parseTimeControl,
} from "@/utils/chess";
import {
  chessopsError,
  forceEnPassant,
  positionFromFen,
  squareToCoordinates,
} from "@/utils/chessops";
import {
  type GameHeaders,
  type TreeNode,
  getNodeAtPath,
} from "@/utils/treeReducer";
import {
  ActionIcon,
  Avatar,
  Box,
  Group,
  Input,
  Paper,
  Progress,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { mergeRefs, useElementSize } from "@mantine/hooks";
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
import type { Color } from "chessground/types";
import {
  type NormalMove,
  type Square,
  type SquareName,
  makeSquare,
  parseSquare,
  parseUci,
} from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { makeSan } from "chessops/san";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useContext, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { match } from "ts-pattern";
import ShowMaterial from "../common/ShowMaterial";
import { TreeDispatchContext } from "../common/TreeStateContext";
import { updateCardPerformance } from "../files/opening";
import { arrowColors } from "../panels/analysis/BestMoves";
import * as classes from "./Board.css";
import EvalBar from "./EvalBar";
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

  const activeTab = useAtomValue(currentTabAtom);
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
        {addGame && activeTab?.file && (
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
      activeTab,
      autoSave,
      dirty,
      keyMap,
      currentTab?.type,
      disableVariations,
      saveFile,
      toggleEditingMode,
      toggleOrientation,
      addGame,
    ],
  );
  const data = getMaterialDiff(currentNode.fen);
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

  let {
    ref: sizeRef,
    width: boardWith,
    height: boardHeight,
  } = useElementSize();

  const fontSize = useAtomValue(fontSizeAtom);
  boardWith = boardWith * (1 / (fontSize / 100));
  boardHeight = boardHeight * (1 / (fontSize / 100));

  const ref = mergeRefs(boardRef, sizeRef);

  return (
    <>
      <Box className={classes.container}>
        <Box className={classes.board}>
          {currentNode.annotations.length > 0 &&
            currentNode.move &&
            square !== undefined && (
              <Box w={boardWith} h={boardHeight} pos="absolute">
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
            ref={ref}
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
        </Box>
        <Box className={classes.top}>
          {data && (
            <Group pb="0.2rem">
              {hasClock && (
                <Paper
                  className={
                    orientation === "white"
                      ? classes.blackClock
                      : classes.whiteClock
                  }
                  styles={{
                    root: {
                      visibility: topClock ? "visible" : "hidden",
                      opacity: turn === orientation ? 0.5 : 1,
                      transition: "opacity 0.15s",
                    },
                  }}
                >
                  <Text fz="lg" fw="bold" px="xs">
                    {topClock ? formatClock(topClock) : "0:00"}
                  </Text>
                  <Progress
                    size="xs"
                    w="100%"
                    value={topProgress * 100}
                    animated={turn !== orientation}
                    styles={{
                      section: {
                        animationDirection: "reverse",
                      },
                    }}
                  />
                </Paper>
              )}
              <ShowMaterial
                diff={data.diff}
                pieces={data.pieces}
                color={orientation === "white" ? "black" : "white"}
              />
            </Group>
          )}
        </Box>
        <Box className={classes.bottom}>
          <Group justify="space-between">
            {data && (
              <Group>
                {hasClock && (
                  <Paper
                    className={
                      orientation === "black"
                        ? classes.blackClock
                        : classes.whiteClock
                    }
                    styles={{
                      root: {
                        opacity: turn !== orientation ? 0.5 : 1,
                        visibility: bottomClock ? "visible" : "hidden",
                        transition: "opacity 0.15s",
                      },
                    }}
                  >
                    <Text fz="lg" fw="bold" px="xs">
                      {bottomClock ? formatClock(bottomClock) : "0:00"}
                    </Text>
                    <Progress
                      size="xs"
                      w="100%"
                      value={bottomProgress * 100}
                      animated={turn === orientation}
                      styles={{
                        section: {
                          animationDirection: "reverse",
                        },
                      }}
                    />
                  </Paper>
                )}
                <ShowMaterial
                  diff={data.diff}
                  pieces={data.pieces}
                  color={orientation}
                />
              </Group>
            )}

            {error && (
              <Text ta="center" c="red">
                {chessopsError(error)}
              </Text>
            )}
            <Group>
              {moveInput && <MoveInput currentNode={currentNode} />}
            </Group>

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

function MoveInput({ currentNode }: { currentNode: TreeNode }) {
  const dispatch = useContext(TreeDispatchContext);
  const [move, setMove] = useState("");
  const [error, setError] = useState("");

  return (
    <Input
      placeholder="Enter move"
      size="sm"
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

function AnnotationHint({
  square,
  annotation,
  orientation,
}: {
  square: Square;
  annotation: Annotation;
  orientation: Color;
}) {
  const { file, rank } = squareToCoordinates(square, orientation);
  const color = ANNOTATION_INFO[annotation]?.color || "gray";

  return (
    <Box
      style={{
        position: "absolute",
        width: "12.5%",
        height: "12.5%",
        left: `${(file - 1) * 12.5}%`,
        bottom: `${(rank - 1) * 12.5}%`,
      }}
    >
      <Box pl="90%">
        {isBasicAnnotation(annotation) && (
          <Box
            style={{
              transform: "translateY(-40%) translateX(-50%)",
              zIndex: 100,
              filter: "url(#shadow)",
              overflow: "initial",
              borderRadius: "50%",
            }}
            w="45%"
            h="45%"
            pos="absolute"
            bg={color}
            variant="filled"
          >
            <svg viewBox="0 0 100 100">
              <title>{annotation}</title>
              <defs>
                <filter id="shadow">
                  <feDropShadow
                    dx="0"
                    dy="1"
                    floodOpacity="0.3"
                    stdDeviation="0"
                  />
                </filter>
              </defs>
              <g>{glyphToSvg[annotation]}</g>
            </svg>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// taken from lichess https://github.com/lichess-org/lila/blob/b7d9abb9f624b1525804aeb49a5b2678f23aae09/ui/analyse/src/glyphs.ts#L49C1-L85
const glyphToSvg = {
  "?!": (
    <>
      <path
        fill="#fff"
        d="M37.734 21.947c-3.714 0-7.128.464-10.242 1.393-3.113.928-6.009 2.13-8.685 3.605l4.343 8.766c2.35-1.202 4.644-2.157 6.883-2.867a22.366 22.366 0 0 1 6.799-1.065c2.294 0 4.07.464 5.326 1.393 1.311.874 1.967 2.186 1.967 3.933 0 1.748-.546 3.277-1.639 4.588-1.038 1.257-2.786 2.758-5.244 4.506-2.786 2.021-4.751 3.961-5.898 5.819-1.147 1.857-1.721 4.15-1.721 6.88v2.952h10.568v-2.377c0-1.147.137-2.103.41-2.868.328-.764.93-1.557 1.803-2.376.874-.82 2.104-1.803 3.688-2.95 2.13-1.584 3.906-3.058 5.326-4.424 1.42-1.42 2.485-2.95 3.195-4.59.71-1.638 1.065-3.576 1.065-5.816 0-4.206-1.584-7.675-4.752-10.406-3.114-2.731-7.51-4.096-13.192-4.096zm24.745.819l2.048 39.084h9.75l2.047-39.084zM35.357 68.73c-1.966 0-3.632.52-4.998 1.557-1.365.983-2.047 2.732-2.047 5.244 0 2.404.682 4.152 2.047 5.244 1.366 1.038 3.032 1.557 4.998 1.557 1.912 0 3.55-.519 4.916-1.557 1.366-1.092 2.05-2.84 2.05-5.244 0-2.512-.684-4.26-2.05-5.244-1.365-1.038-3.004-1.557-4.916-1.557zm34.004 0c-1.966 0-3.632.52-4.998 1.557-1.365.983-2.049 2.732-2.049 5.244 0 2.404.684 4.152 2.05 5.244 1.365 1.038 3.03 1.557 4.997 1.557 1.912 0 3.55-.519 4.916-1.557 1.366-1.092 2.047-2.84 2.047-5.244 0-2.512-.681-4.26-2.047-5.244-1.365-1.038-3.004-1.557-4.916-1.557z"
      />
    </>
  ),
  "?": (
    <>
      <path
        fill="#fff"
        d="M40.436 60.851q0-4.66 1.957-7.83 1.958-3.17 6.712-6.619 4.195-2.983 5.967-5.127 1.864-2.237 1.864-5.22 0-2.983-2.237-4.475-2.144-1.585-6.06-1.585-3.915 0-7.737 1.212t-7.83 3.263l-4.941-9.975q4.568-2.517 9.881-4.101 5.314-1.585 11.653-1.585 9.695 0 15.008 4.661 5.407 4.661 5.407 11.839 0 3.822-1.212 6.619-1.212 2.796-3.635 5.22-2.424 2.33-6.06 5.034-2.703 1.958-4.195 3.356-1.491 1.398-2.05 2.703-.467 1.305-.467 3.263v2.703H40.436zm-1.492 18.924q0-4.288 2.33-5.966 2.331-1.771 5.687-1.771 3.263 0 5.594 1.771 2.33 1.678 2.33 5.966 0 4.102-2.33 5.966-2.331 1.772-5.594 1.772-3.356 0-5.686-1.772-2.33-1.864-2.33-5.966z"
      />
    </>
  ),
  "??": (
    <>
      <path
        fill="#fff"
        d="M31.8 22.22c-3.675 0-7.052.46-10.132 1.38-3.08.918-5.945 2.106-8.593 3.565l4.298 8.674c2.323-1.189 4.592-2.136 6.808-2.838a22.138 22.138 0 0 1 6.728-1.053c2.27 0 4.025.46 5.268 1.378 1.297.865 1.946 2.16 1.946 3.89s-.541 3.242-1.622 4.539c-1.027 1.243-2.756 2.73-5.188 4.458-2.756 2-4.7 3.918-5.836 5.755-1.134 1.837-1.702 4.107-1.702 6.808v2.92h10.457v-2.35c0-1.135.135-2.082.406-2.839.324-.756.918-1.54 1.783-2.35.864-.81 2.079-1.784 3.646-2.918 2.107-1.568 3.863-3.026 5.268-4.376 1.405-1.405 2.46-2.92 3.162-4.541.703-1.621 1.054-3.54 1.054-5.755 0-4.161-1.568-7.592-4.702-10.294-3.08-2.702-7.43-4.052-13.05-4.052zm38.664 0c-3.675 0-7.053.46-10.133 1.38-3.08.918-5.944 2.106-8.591 3.565l4.295 8.674c2.324-1.189 4.593-2.136 6.808-2.838a22.138 22.138 0 0 1 6.728-1.053c2.27 0 4.026.46 5.269 1.378 1.297.865 1.946 2.16 1.946 3.89s-.54 3.242-1.62 4.539c-1.027 1.243-2.757 2.73-5.189 4.458-2.756 2-4.7 3.918-5.835 5.755-1.135 1.837-1.703 4.107-1.703 6.808v2.92h10.457v-2.35c0-1.135.134-2.082.404-2.839.324-.756.918-1.54 1.783-2.35.865-.81 2.081-1.784 3.648-2.918 2.108-1.568 3.864-3.026 5.269-4.376 1.405-1.405 2.46-2.92 3.162-4.541.702-1.621 1.053-3.54 1.053-5.755 0-4.161-1.567-7.592-4.702-10.294-3.08-2.702-7.43-4.052-13.05-4.052zM29.449 68.504c-1.945 0-3.593.513-4.944 1.54-1.351.973-2.027 2.703-2.027 5.188 0 2.378.676 4.108 2.027 5.188 1.35 1.027 3 1.54 4.944 1.54 1.892 0 3.512-.513 4.863-1.54 1.35-1.08 2.026-2.81 2.026-5.188 0-2.485-.675-4.215-2.026-5.188-1.351-1.027-2.971-1.54-4.863-1.54zm38.663 0c-1.945 0-3.592.513-4.943 1.54-1.35.973-2.026 2.703-2.026 5.188 0 2.378.675 4.108 2.026 5.188 1.351 1.027 2.998 1.54 4.943 1.54 1.891 0 3.513-.513 4.864-1.54 1.351-1.08 2.027-2.81 2.027-5.188 0-2.485-.676-4.215-2.027-5.188-1.35-1.027-2.973-1.54-4.864-1.54z"
      />
    </>
  ),
  "!?": (
    <>
      <path
        fill="#fff"
        d="M60.823 58.9q0-4.098 1.72-6.883 1.721-2.786 5.9-5.818 3.687-2.622 5.243-4.506 1.64-1.966 1.64-4.588t-1.967-3.933q-1.885-1.393-5.326-1.393t-6.8 1.065q-3.36 1.065-6.883 2.868l-4.343-8.767q4.015-2.212 8.685-3.605 4.67-1.393 10.242-1.393 8.521 0 13.192 4.097 4.752 4.096 4.752 10.405 0 3.36-1.065 5.818-1.066 2.458-3.196 4.588-2.13 2.048-5.326 4.424-2.376 1.72-3.687 2.95-1.31 1.229-1.802 2.376-.41 1.147-.41 2.868v2.376h-10.57zm-1.311 16.632q0-3.77 2.048-5.244 2.049-1.557 4.998-1.557 2.868 0 4.916 1.557 2.049 1.475 2.049 5.244 0 3.605-2.049 5.244-2.048 1.556-4.916 1.556-2.95 0-4.998-1.556-2.048-1.64-2.048-5.244zM36.967 61.849h-9.75l-2.049-39.083h13.847zM25.004 75.532q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z"
        vectorEffect="non-scaling-stroke"
      />
    </>
  ),
  "!": (
    <>
      <path
        fill="#fff"
        d="M54.967 62.349h-9.75l-2.049-39.083h13.847zM43.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z"
        vectorEffect="non-scaling-stroke"
      />
    </>
  ),
  "!!": (
    <>
      <path
        fill="#fff"
        d="M71.967 62.349h-9.75l-2.049-39.083h13.847zM60.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244zM37.967 62.349h-9.75l-2.049-39.083h13.847zM26.004 76.032q0-3.77 2.049-5.244 2.048-1.557 4.998-1.557 2.867 0 4.916 1.557 2.048 1.475 2.048 5.244 0 3.605-2.048 5.244-2.049 1.556-4.916 1.556-2.95 0-4.998-1.556-2.049-1.64-2.049-5.244z"
        vectorEffect="non-scaling-stroke"
      />
    </>
  ),
} as const;

function formatClock(seconds: number) {
  let s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  s = (s % 3600) % 60;

  let timeString = `${minutes.toString().padStart(2, "0")}`;
  if (hours > 0) {
    timeString = `${hours}:${timeString}`;
  }
  if (seconds < 60) {
    timeString += `:${s.toFixed(1).padStart(4, "0")}`;
  } else {
    timeString += `:${Math.floor(s).toString().padStart(2, "0")}`;
  }
  return timeString;
}

export default memo(Board);
