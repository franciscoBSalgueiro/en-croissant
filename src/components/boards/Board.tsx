import type { DrawShape } from "@lichess-org/chessground/draw";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronRight } from "@tabler/icons-react";
import {
  makeSquare,
  makeUci,
  type NormalMove,
  type Piece,
  parseSquare,
  parseUci,
  type SquareName,
} from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useContext, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Chessground, type ChessgroundRef } from "@/chessground/Chessground";
import {
  autoPromoteAtom,
  bestMovesFamily,
  currentEvalOpenAtom,
  currentTabAtom,
  deckAtomFamily,
  enableBoardScrollAtom,
  eraseDrawablesOnClickAtom,
  forcedEnPassantAtom,
  moveHighlightAtom,
  moveInputAtom,
  practiceCardStartTimeAtom,
  practiceSessionStatsAtom,
  practiceStateAtom,
  showArrowsAtom,
  showConsecutiveArrowsAtom,
  showCoordinatesAtom,
  showDestsAtom,
  snapArrowsAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { chessboard } from "@/styles/Chessboard.css";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import { getMaterialDiff, getVariationLine } from "@/utils/chess";
import {
  chessopsError,
  forceEnPassant,
  positionFromFen,
} from "@/utils/chessops";
import { getClockInfo, type TimeControlField } from "@/utils/clock";
import { getNodeAtPath } from "@/utils/treeReducer";
import ShowMaterial from "../common/ShowMaterial";
import { TreeStateContext } from "../common/TreeStateContext";
import FideInfo from "../databases/FideInfo";
import { updateCardPerformance } from "../files/opening";
import { arrowColors } from "../panels/analysis/BestMoves";
import AnnotationHint from "./AnnotationHint";
import { BoardBar } from "./BoardBar";
import Clock from "./Clock";
import EvalBar from "./EvalBar";
import MoveInput from "./MoveInput";
import PromotionModal from "./PromotionModal";

const LARGE_BRUSH = 11;
const MEDIUM_BRUSH = 7.5;
const SMALL_BRUSH = 4;
const BAR_HEIGHT = "1.9rem";

interface ChessboardProps {
  editingMode: boolean;
  viewOnly?: boolean;
  disableVariations?: boolean;
  movable?: "both" | "white" | "black" | "turn" | "none";
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  whiteTime?: number;
  blackTime?: number;
  practicing?: boolean;
  selectedPiece?: Piece | null;
  onMove?: (uci: string) => void;
  cgRef?: React.Ref<ChessgroundRef>;
  enablePremoves?: boolean;
}

function Board({
  editingMode,
  viewOnly,
  disableVariations,
  movable = "turn",
  boardRef,
  whiteTime,
  blackTime,
  practicing,
  selectedPiece,
  onMove,
  cgRef,
  enablePremoves = false,
}: ChessboardProps) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;

  const root = useStore(store, (s) => s.root);
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );
  const headers = useStore(store, (s) => s.headers);
  const currentNode = useStore(store, (s) => s.currentNode());

  const arrows = useAtomValue(
    bestMovesFamily({
      fen: rootFen,
      gameMoves: moves,
    }),
  );

  const goToNext = useStore(store, (s) => s.goToNext);
  const goToPrevious = useStore(store, (s) => s.goToPrevious);
  const storeMakeMove = useStore(store, (s) => s.makeMove);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setShapes = useStore(store, (s) => s.setShapes);
  const setFen = useStore(store, (s) => s.setFen);

  const [pos, error] = positionFromFen(currentNode.fen);
  const [whiteFideOpen, setWhiteFideOpen] = useState(false);
  const [blackFideOpen, setBlackFideOpen] = useState(false);

  const moveInput = useAtomValue(moveInputAtom);
  const showDests = useAtomValue(showDestsAtom);
  const moveHighlight = useAtomValue(moveHighlightAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const showConsecutiveArrows = useAtomValue(showConsecutiveArrowsAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);
  const autoPromote = useAtomValue(autoPromoteAtom);
  const forcedEP = useAtomValue(forcedEnPassantAtom);
  const showCoordinates = useAtomValue(showCoordinatesAtom);

  let dests: Map<SquareName, SquareName[]> = pos
    ? chessgroundDests(pos)
    : new Map();
  if (forcedEP && pos) {
    dests = forceEnPassant(dests, pos);
  }

  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const turn = pos?.turn || "white";
  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen,
      orientation: orientation === "black" ? "white" : "black",
    });

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.SWAP_ORIENTATION.keys, () => toggleOrientation());
  const currentTab = useAtomValue(currentTabAtom);
  const [evalOpen, setEvalOpen] = useAtom(currentEvalOpenAtom);

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      file: currentTab?.file?.path || "",
      game: currentTab?.gameNumber || 0,
    }),
  );

  const setPracticeState = useSetAtom(practiceStateAtom);
  const setSessionStats = useSetAtom(practiceSessionStatsAtom);
  const cardStartTime = useAtomValue(practiceCardStartTimeAtom);

  async function makeMove(move: NormalMove) {
    if (!pos) return;
    const san = makeSan(pos, move);
    if (practicing) {
      const c = deck.positions.find((c) => c.fen === currentNode.fen);
      if (!c) {
        return;
      }

      const i = deck.positions.indexOf(c);
      const timeTaken = Date.now() - cardStartTime;

      if (san !== c.answer) {
        updateCardPerformance(setDeck, i, c.card, 1);
        setPracticeState({
          phase: "incorrect",
          currentFen: c.fen,
          answer: c.answer,
          playedMove: san,
          positionIndex: i,
          timeTaken,
        });
        setSessionStats((prev) => ({
          ...prev,
          incorrect: prev.incorrect + 1,
          streak: 0,
        }));
        notifications.show({
          title: t("Common.Incorrect"),
          message: t("Board.Practice.CorrectMoveWas", { move: c.answer }),
          color: "red",
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        goToNext();
      } else {
        storeMakeMove({
          payload: move,
        });
        setPendingMove(null);
        setPracticeState({
          phase: "correct",
          currentFen: c.fen,
          answer: c.answer,
          positionIndex: i,
          timeTaken,
        });
      }
    } else {
      storeMakeMove({
        payload: move,
        clock: pos.turn === "white" ? whiteTime : blackTime,
      });
      setPendingMove(null);

      if (onMove) {
        onMove(makeUci(move));
      }
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

  const hasClock =
    !!whiteTime ||
    !!blackTime ||
    !!headers.time_control ||
    !!headers.white_time_control ||
    !!headers.black_time_control;

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

  const [enableBoardScroll] = useAtom(enableBoardScrollAtom);
  const [snapArrows] = useAtom(snapArrowsAtom);

  const setBoardFen = useCallback(
    (fen: string) => {
      if (!fen || !editingMode) {
        return;
      }
      const newFen = `${fen} ${currentNode.fen.split(" ").slice(1).join(" ")}`;

      if (newFen !== currentNode.fen) {
        setFen(newFen);
      }
    },
    [editingMode, currentNode, setFen],
  );

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

  const topPlayer = orientation === "white" ? headers.black : headers.white;
  const bottomPlayer = orientation === "white" ? headers.white : headers.black;

  return (
    <>
      <Box w="100%" h="100%">
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            gap: "0.5rem",
            flexWrap: "nowrap",
            overflow: "hidden",
            maxWidth:
              //            topbar   bottompadding                tabs                                  bottomb    topbar   evalbar                                gaps    ???
              `calc(100vh - 2.25rem - var(--mantine-spacing-sm) - 2.5rem - var(--mantine-spacing-sm) - ${BAR_HEIGHT} - ${BAR_HEIGHT} + 1.563rem + var(--mantine-spacing-md) - 1rem  - 0.2rem)`,
          }}
        >
          <BoardBar
            name={topPlayer}
            rating={
              orientation === "white" ? headers.black_elo : headers.white_elo
            }
            onNameClick={() => {
              if (orientation === "white") {
                setBlackFideOpen(true);
              } else {
                setWhiteFideOpen(true);
              }
            }}
            height={BAR_HEIGHT}
          >
            {materialDiff && (
              <ShowMaterial
                diff={materialDiff.diff}
                pieces={materialDiff.pieces}
                color={orientation === "white" ? "black" : "white"}
              />
            )}
            {hasClock && (
              <Clock
                color={orientation === "black" ? "white" : "black"}
                turn={turn}
                whiteTime={whiteTime}
                blackTime={blackTime}
              />
            )}
          </BoardBar>
          <Group
            style={{
              position: "relative",
              flexWrap: "nowrap",
            }}
            gap="sm"
          >
            {currentNode.annotations.length > 0 &&
              currentNode.move &&
              square !== undefined && (
                <Box pl="2.5rem" w="100%" h="100%" pos="absolute">
                  <Box pos="relative" w="100%" h="100%">
                    <AnnotationHint
                      orientation={orientation}
                      square={square}
                      annotation={currentNode.annotations[0]}
                    />
                  </Box>
                </Box>
              )}
            <Box
              h="100%"
              style={{
                width: 25,
              }}
            >
              {!evalOpen && (
                <Center h="100%" w="100%">
                  <ActionIcon
                    size="1rem"
                    onClick={() => setEvalOpen(true)}
                    onContextMenu={(e) => {
                      setEvalOpen(true);
                      e.preventDefault();
                    }}
                  >
                    <IconChevronRight />
                  </ActionIcon>
                </Center>
              )}
              {evalOpen && (
                <EvalBar
                  score={currentNode.score || null}
                  orientation={orientation}
                />
              )}
            </Box>
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
              onClick={() => {
                eraseDrawablesOnClick && clearShapes();
              }}
              onWheel={(e) => {
                if (enableBoardScroll) {
                  if (e.deltaY > 0) {
                    goToNext();
                  } else {
                    goToPrevious();
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
                ref={cgRef}
                setBoardFen={setBoardFen}
                orientation={orientation}
                fen={currentNode.fen}
                animation={{ enabled: !editingMode }}
                coordinates={showCoordinates !== "no"}
                coordinatesOnSquares={showCoordinates === "all"}
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
                    after(orig, dest, metadata) {
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
                events={{
                  select: (key) => {
                    if (editingMode && selectedPiece) {
                      const square = parseSquare(key);
                      if (square) {
                        const setup = parseFen(currentNode.fen).unwrap();
                        setup.board.set(square, selectedPiece);
                        setFen(makeFen(setup));
                      }
                    }
                  },
                }}
                turnColor={turn}
                check={moveHighlight && pos?.isCheck()}
                lastMove={moveHighlight && !editingMode ? lastMove : undefined}
                premovable={{
                  enabled: enablePremoves && !editingMode && !viewOnly,
                }}
                draggable={{
                  enabled: true,
                  deleteOnDropOff: editingMode,
                }}
                drawable={{
                  enabled: true,
                  visible: true,
                  defaultSnapToValidMove: snapArrows,
                  autoShapes: shapes,
                  onChange: (shapes) => {
                    setShapes(shapes);
                  },
                }}
              />
            </Box>
          </Group>
          <BoardBar
            name={bottomPlayer}
            rating={
              orientation === "white" ? headers.white_elo : headers.black_elo
            }
            onNameClick={() => {
              if (orientation === "white") {
                setWhiteFideOpen(true);
              } else {
                setBlackFideOpen(true);
              }
            }}
            height={BAR_HEIGHT}
          >
            {error && (
              <Text ta="center" c="red">
                {t(chessopsError(error))}
              </Text>
            )}

            {moveInput && <MoveInput currentNode={currentNode} />}

            {materialDiff && (
              <ShowMaterial
                diff={materialDiff.diff}
                pieces={materialDiff.pieces}
                color={orientation}
              />
            )}
            {hasClock && (
              <Clock
                color={orientation}
                turn={turn}
                whiteTime={whiteTime}
                blackTime={blackTime}
              />
            )}
          </BoardBar>
        </Box>
      </Box>
      <FideInfo
        opened={whiteFideOpen}
        setOpened={setWhiteFideOpen}
        name={headers.white}
      />
      <FideInfo
        opened={blackFideOpen}
        setOpened={setBlackFideOpen}
        name={headers.black}
      />
    </>
  );
}

export default memo(Board);
