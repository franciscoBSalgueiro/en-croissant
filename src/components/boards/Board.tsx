import { Chessground } from "@/chessground/Chessground";
import {
  autoPromoteAtom,
  autoSaveAtom,
  bestMovesFamily,
  currentEvalOpenAtom,
  currentTabAtom,
  deckAtomFamily,
  enableBoardScrollAtom,
  eraseDrawablesOnClickAtom,
  forcedEnPassantAtom,
  moveInputAtom,
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
import { type TimeControlField, getClockInfo } from "@/utils/clock";
import { getNodeAtPath } from "@/utils/treeReducer";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Menu,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBack,
  IconCamera,
  IconChess,
  IconChessFilled,
  IconChevronRight,
  IconDeviceFloppy,
  IconDotsVertical,
  IconEdit,
  IconEditOff,
  IconEraser,
  IconPlus,
  IconSwitchVertical,
  IconTarget,
  IconZoomCheck,
} from "@tabler/icons-react";
import { documentDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
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
import domtoimage from "dom-to-image";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useContext, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import ShowMaterial from "../common/ShowMaterial";
import { TreeStateContext } from "../common/TreeStateContext";
import { updateCardPerformance } from "../files/opening";
import { arrowColors } from "../panels/analysis/BestMoves";
import AnnotationHint from "./AnnotationHint";
import Clock from "./Clock";
import EvalBar from "./EvalBar";
import MoveInput from "./MoveInput";
import PromotionModal from "./PromotionModal";

const LARGE_BRUSH = 11;
const MEDIUM_BRUSH = 7.5;
const SMALL_BRUSH = 4;

interface ChessboardProps {
  dirty: boolean;
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
  practicing?: boolean;
}

function Board({
  dirty,
  editingMode,
  toggleEditingMode,
  viewOnly,
  disableVariations,
  movable = "turn",
  boardRef,
  saveFile,
  addGame,
  canTakeBack,
  whiteTime,
  blackTime,
  practicing,
}: ChessboardProps) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;

  const root = useStore(store, (s) => s.root);
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );
  const position = useStore(store, (s) => s.position);
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
  const deleteMove = useStore(store, (s) => s.deleteMove);
  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setShapes = useStore(store, (s) => s.setShapes);
  const setFen = useStore(store, (s) => s.setFen);

  const [pos, error] = positionFromFen(currentNode.fen);

  const moveInput = useAtomValue(moveInputAtom);
  const showDests = useAtomValue(showDestsAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const showConsecutiveArrows = useAtomValue(showConsecutiveArrowsAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);
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

  const [viewPawnStructure, setViewPawnStructure] = useState(false);
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const turn = pos?.turn || "white";
  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen, // To keep the current board setup
      orientation: orientation === "black" ? "white" : "black",
    });

  const takeSnapshot = async () => {
    const ref = boardRef?.current;
    if (ref == null) return;

    // We must get the first children three levels below, as it has the right dimensions.
    const refChildNode = ref.children[0].children[0].children[0] as HTMLElement;
    if (refChildNode == null) return;

    domtoimage.toBlob(refChildNode).then(async (blob) => {
      if (blob == null) return;
      const documentsDirPath = await documentDir();

      const filePath = await save({
        title: "Save board snapshot",
        defaultPath: documentsDirPath,
        filters: [
          {
            name: "Png image",
            extensions: ["png"],
          },
        ],
      });
      const arrayBuffer = await blob.arrayBuffer();
      if (filePath == null) return;
      await writeFile(filePath, new Uint8Array(arrayBuffer));
    });
  };

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
      }

      updateCardPerformance(setDeck, i, c.card, isRecalled ? 4 : 1);
    } else {
      storeMakeMove({
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

  const hasClock =
    whiteTime !== undefined ||
    blackTime !== undefined ||
    headers.time_control !== undefined ||
    headers.white_time_control !== undefined ||
    headers.black_time_control !== undefined;

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
        <Menu closeOnItemClick={false}>
          <Menu.Target>
            <ActionIcon variant="default" size="lg">
              <IconDotsVertical size="1.3rem" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                viewPawnStructure ? (
                  <IconChessFilled size="1.3rem" />
                ) : (
                  <IconChess size="1.3rem" />
                )
              }
              onClick={() => setViewPawnStructure(!viewPawnStructure)}
            >
              {t("Board.Action.TogglePawnStructureView")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCamera size="1.3rem" />}
              onClick={() => takeSnapshot()}
            >
              {t("Board.Action.TakeSnapshot")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {canTakeBack && (
          <Tooltip label="Take Back">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => deleteMove()}
            >
              <IconArrowBack />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip
          label={t(
            currentTab?.type === "analysis"
              ? "Board.Action.PlayFromHere"
              : "Board.AnalyzeGame",
          )}
        >
          <ActionIcon variant="default" size="lg" onClick={changeTabType}>
            {currentTab?.type === "analysis" ? (
              <IconTarget size="1.3rem" />
            ) : (
              <IconZoomCheck size="1.3rem" />
            )}
          </ActionIcon>
        </Tooltip>
        {!eraseDrawablesOnClick && (
          <Tooltip label={t("Board.Action.ClearDrawings")}>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => clearShapes()}
            >
              <IconEraser size="1.3rem" />
            </ActionIcon>
          </Tooltip>
        )}
        {!disableVariations && (
          <Tooltip label={t("Board.Action.EditPosition")}>
            <ActionIcon
              variant={editingMode ? "filled" : "default"}
              size="lg"
              onClick={() => toggleEditingMode()}
            >
              {editingMode ? (
                <IconEditOff size="1.3rem" />
              ) : (
                <IconEdit size="1.3rem" />
              )}
            </ActionIcon>
          </Tooltip>
        )}

        {saveFile && (
          <Tooltip
            label={t("Board.Action.SavePGN", { key: keyMap.SAVE_FILE.keys })}
          >
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
          <Tooltip label={t("Board.Action.AddGame")}>
            <ActionIcon variant="default" size="lg" onClick={() => addGame()}>
              <IconPlus size="1.3rem" />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip
          label={t("Board.Action.FlipBoard", {
            key: keyMap.SWAP_ORIENTATION.keys,
          })}
        >
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

  return (
    <>
      {viewPawnStructure && (
        <Helmet>
          <link rel="stylesheet" href="/pieces/view-pawn-structure.css" />
        </Helmet>
      )}
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
              "calc(100vh - 2.5rem - var(--mantine-spacing-sm) - 2.778rem - var(--mantine-spacing-sm) - 2.125rem - 2.125rem + 1.563rem + var(--mantine-spacing-md) - 1rem  - 0.75rem)",
          }}
        >
          {materialDiff && (
            <Group ml="2.5rem" h="2.125rem">
              {hasClock && (
                <Clock
                  color={orientation === "black" ? "white" : "black"}
                  turn={turn}
                  whiteTime={whiteTime}
                  blackTime={blackTime}
                />
              )}
              <ShowMaterial
                diff={materialDiff.diff}
                pieces={materialDiff.pieces}
                color={orientation === "white" ? "black" : "white"}
              />
            </Group>
          )}
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
                  <ActionIcon size="1rem" onClick={() => setEvalOpen(true)}>
                    <IconChevronRight />
                  </ActionIcon>
                </Center>
              )}
              {evalOpen && (
                <Box onClick={() => setEvalOpen(false)} h="100%">
                  <EvalBar
                    score={currentNode.score?.value || null}
                    orientation={orientation}
                  />
                </Box>
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
                turnColor={turn}
                check={pos?.isCheck()}
                lastMove={editingMode ? undefined : lastMove}
                premovable={{
                  enabled: false,
                }}
                draggable={{
                  enabled: !viewPawnStructure,
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
          <Group justify="space-between" h="2.125rem">
            {materialDiff && (
              <Group ml="2.5rem">
                {hasClock && (
                  <Clock
                    color={orientation}
                    turn={turn}
                    whiteTime={whiteTime}
                    blackTime={blackTime}
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
                {t(chessopsError(error))}
              </Text>
            )}

            {moveInput && <MoveInput currentNode={currentNode} />}

            {controls}
          </Group>
        </Box>
      </Box>
    </>
  );
}

export default memo(Board);
