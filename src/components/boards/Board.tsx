import { Chessground } from "@/chessground/Chessground";
import {
  arrowColorMeaningAtom,
  arrowOpacityMeaningAtom,
  arrowSizeMeaningAtom,
  arrowOpacityAtom,
  arrowSizeScaleAtom,
  autoPromoteAtom,
  autoSaveAtom,
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
import { unifiedBoardArrowsFamily } from "@/state/unifiedMoves";
import { currentBotSuggestionAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { chessboard } from "@/styles/Chessboard.css";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import { getMaterialDiff, getVariationLine, type PiecesCount } from "@/utils/chess";
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
import { memo, useCallback, useContext, useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import * as React from "react";
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

const BASE_LARGE_BRUSH = 11;
const BASE_MEDIUM_BRUSH = 7.5;
const BASE_SMALL_BRUSH = 4;

// Memoized color calculation for performance
const qualityColorCache = new Map<string, string>();

function pctBestToColor(pctBest: number, isMainLine: boolean): string {
  const v = Math.max(0, Math.min(100, pctBest));
  if (v >= 66) return isMainLine ? "green" : "paleGreen";
  if (v >= 33) return "yellow";
  return isMainLine ? "red" : "paleRed";
}

function getQualityColor(winChance: number, isMainLine: boolean): string {
  const cacheKey = `${Math.round(winChance * 10) / 10}-${isMainLine}`;
  if (qualityColorCache.has(cacheKey)) {
    return qualityColorCache.get(cacheKey)!;
  }

  // Convert win chance to color gradient
  // 50% = neutral, >50% = green (good), <50% = red (bad)
  const deviation = winChance - 50;
  const intensity = Math.min(Math.abs(deviation) / 50, 1); // 0-1 scale

  let color: string;

  if (Math.abs(deviation) < 2.5) {
    // Near-neutral positions (±2.5% from 50%)
    color = "yellow"; // Use yellow for all neutral moves
  } else if (deviation > 0) {
    // Good moves - green spectrum
    color = isMainLine ? "green" : "paleGreen";
  } else {
    // Bad moves - red spectrum
    color = isMainLine ? "red" : "paleRed";
  }

  qualityColorCache.set(cacheKey, color);
  return color;
}

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
  // NEW: if true, size strictly by container (do not cap by viewport height)
  fitContainer?: boolean;
  // NEW: notify parent about captured pieces per side
  onCapturedChange?: (captured: { white: PiecesCount; black: PiecesCount }) => void;
  // NEW: notify parent about material diff (white minus black)
  onMaterialDiffChange?: (diff: number) => void;
  // NEW: notify parent when a move is made (SAN and color)
  onMoveMade?: (info: { san: string; color: "white" | "black" }) => void;
  // NEW: if true, render controls externally (caller is responsible for rendering them)
  externalControls?: boolean;
  // NEW: callback to provide controls JSX element to parent
  onControlsReady?: (controls: JSX.Element) => void;
  // NEW: when this number changes, force a Chessground remount/redraw
  redrawSeq?: number;
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
  fitContainer = false,
  onCapturedChange,
  onMaterialDiffChange,
  onMoveMade,
  externalControls = false,
  onControlsReady,
  redrawSeq,
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

  // Compute captured pieces from root fen by simulating current moves
  const captured = useMemo(() => {
    const zero: PiecesCount = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const result = { white: { ...zero }, black: { ...zero } } as {
      white: PiecesCount;
      black: PiecesCount;
    };
    const [start] = positionFromFen(rootFen);
    if (!start) return result;

    const countByRole = (pos: any) => ({
      white: {
        p: pos.board.white.intersect(pos.board.pawn).size(),
        n: pos.board.white.intersect(pos.board.knight).size(),
        b: pos.board.white.intersect(pos.board.bishop).size(),
        r: pos.board.white.intersect(pos.board.rook).size(),
        q: pos.board.white.intersect(pos.board.queen).size(),
      },
      black: {
        p: pos.board.black.intersect(pos.board.pawn).size(),
        n: pos.board.black.intersect(pos.board.knight).size(),
        b: pos.board.black.intersect(pos.board.bishop).size(),
        r: pos.board.black.intersect(pos.board.rook).size(),
        q: pos.board.black.intersect(pos.board.queen).size(),
      },
    });

    let pos = start.clone();
    let pre = countByRole(pos);
    for (const uci of moves) {
      const mover = pos.turn; // color before move
      const move = parseUci(uci);
      if (!move) break;
      pos.play(move as NormalMove);
      const post = countByRole(pos);
      const takenFrom = mover === "white" ? "black" : "white";
      const addTo = mover === "white" ? "white" : "black";
      const roles: (keyof PiecesCount)[] = ["p", "n", "b", "r", "q"];
      for (const r of roles) {
        const delta = pre[takenFrom][r] - post[takenFrom][r];
        if (delta > 0) {
          (result[addTo][r] as number) += delta;
        }
      }
      pre = post;
    }
    return result;
  }, [rootFen, moves]);

  useEffect(() => {
    if (onCapturedChange) onCapturedChange(captured);
  }, [captured, onCapturedChange]);

  const arrows = useAtomValue(
    unifiedBoardArrowsFamily({
      rootFen,
      fen: currentNode.fen,
      gameMoves: moves,
    }),
  );
  const botSuggestion = useAtomValue(currentBotSuggestionAtom);
  // Type guard for Map iteration
  const arrowsMap: Map<number, { pv: string[]; winChance: number }[]> = arrows as any;

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
  const arrowColorMeaning = useAtomValue(arrowColorMeaningAtom);
  const arrowOpacityMeaning = useAtomValue(arrowOpacityMeaningAtom);
  const arrowSizeMeaning = useAtomValue(arrowSizeMeaningAtom);
  const arrowOpacity = useAtomValue(arrowOpacityAtom);
  const arrowSizeScale = useAtomValue(arrowSizeScaleAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);
  const autoPromote = useAtomValue(autoPromoteAtom);
  const forcedEP = useAtomValue(forcedEnPassantAtom);
  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const autoSave = useAtomValue(autoSaveAtom);

  // Notify parent about material diff
  const materialDiff = getMaterialDiff(currentNode.fen);
  useEffect(() => {
    if (onMaterialDiffChange && materialDiff) {
      onMaterialDiffChange(materialDiff.diff);
    }
  }, [onMaterialDiffChange, materialDiff?.diff]);

  let dests: Map<SquareName, SquareName[]> = pos
    ? chessgroundDests(pos)
    : new Map();
  if (forcedEP && pos) {
    dests = forceEnPassant(dests, pos);
  }

  const [viewPawnStructure, setViewPawnStructure] = useState(false);
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);
  const [autoFlip, setAutoFlip] = useState(false);

  const turn = pos?.turn || "white";
  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen, // To keep the current board setup
      orientation: orientation === "black" ? "white" : "black",
    });

  // Auto-flip orientation to face the active player when enabled
  useEffect(() => {
    if (!autoFlip || !pos) return;
    const desired: "white" | "black" = pos.turn;
    if (headers.orientation !== desired) {
      setHeaders({
        ...headers,
        fen: root.fen,
        orientation: desired,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFlip, pos?.turn]);

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
  useHotkeys(keyMap.TAKE_BACK.keys, () => {
    if (canTakeBack) {
      goToPrevious();
    }
  });
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, () => goToPrevious());
  useHotkeys(keyMap.NEXT_MOVE.keys, () => goToNext());
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
        onMoveMade?.({ san, color: pos.turn });
        setPendingMove(null);
      }

      updateCardPerformance(setDeck, i, c.card, isRecalled ? 4 : 1);
    } else {
      storeMakeMove({
        payload: move,
        clock: pos.turn === "white" ? whiteTime : blackTime,
      });
      onMoveMade?.({ san, color: pos.turn });
      setPendingMove(null);
    }
  }

  let shapes: DrawShape[] = [];
  if (showArrows && evalOpen && arrowsMap.size > 0 && pos) {
    // Clear color cache periodically to prevent memory leaks
    if (arrowColorMeaning === "score" && qualityColorCache.size > 100) {
      qualityColorCache.clear();
    }
    const entries = Array.from(arrowsMap.entries()).sort((a, b) => a[0] - b[0]);
    for (const [i, moves] of entries) {
      if (i < 4) {
        const bestWinChance = moves[0].winChance;
        // Compute pctBest for this engine's list using dynamic spread instead of fixed +/-10
        const minWinChance = moves.reduce((acc, m) => (m.winChance < acc ? m.winChance : acc), bestWinChance);
        const range = Math.max(1e-3, bestWinChance - minWinChance);
        const pctBestForMove = (w: number, isMain: boolean) => {
          if (range < 1e-2) return isMain ? 100 : 40; // avoid all-green when lines are nearly identical
          return 100 * Math.max(0, Math.min(1, (w - minWinChance) / range));
        };
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
            // Determine size base according to size meaning
            const sizeFromRank = match(bestWinChance - winChance)
              .when((d) => d < 2.5, () => BASE_LARGE_BRUSH)
              .when((d) => d < 5, () => BASE_MEDIUM_BRUSH)
              .otherwise(() => BASE_SMALL_BRUSH);
            const sizeFromScore = (() => {
              // Map winChance to brush: >55 large, >50 medium, else small
              if (winChance > 55) return BASE_LARGE_BRUSH;
              if (winChance > 50) return BASE_MEDIUM_BRUSH;
              return BASE_SMALL_BRUSH;
            })();
            const sizeFromPctBest = (() => {
              const p = pctBestForMove(winChance, true);
              if (p >= 66) return BASE_LARGE_BRUSH;
              if (p >= 33) return BASE_MEDIUM_BRUSH;
              return BASE_SMALL_BRUSH;
            })();
            const brushSizeBase = arrowSizeMeaning === "uniform"
              ? BASE_MEDIUM_BRUSH
              : arrowSizeMeaning === "rank"
                ? sizeFromRank
                : arrowSizeMeaning === "score"
                  ? sizeFromScore
                  : sizeFromPctBest;
            const brushSize = Math.max(1, Math.round(brushSizeBase * Math.max(0.5, Math.min(2, arrowSizeScale))));

            if (
              ii === 0 ||
              (showConsecutiveArrows && j === 0 && ii % 2 === 0)
            ) {
              if (
                ii < 5 && // max 3 arrows
                !shapes.find((s) => s.orig === from && s.dest === to) &&
                prevSquare === from
              ) {
                const brushColor = (() => {
                  // Color meaning: rank | score | pctBest | uniform
                  if (arrowColorMeaning === "uniform") {
                    return arrowColors[i].strong;
                  }
                  if (arrowColorMeaning === "rank") {
                    return j === 0 ? arrowColors[i].strong : arrowColors[i].pale;
                  }
                  if (arrowColorMeaning === "score") {
                    // Use quality coloring based on winChance
                    return getQualityColor(winChance, true);
                  }
                  // pctBest
                  return pctBestToColor(pctBestForMove(winChance, true), true);
                })();

                shapes.push({
                  orig: from,
                  dest: to,
                  brush: brushColor,
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

  // Add bot suggestion arrow (semi-transparent black), if present
  if (botSuggestion) {
    try {
      const from = parseSquare(botSuggestion.from)!;
      const to = parseSquare(botSuggestion.to)!;
      // Highlight from and to squares with circles instead of drawing an arrow
      shapes.push({
        orig: makeSquare(from)!,
        brush: "blue",
        modifiers: { lineWidth: Math.max(1, Math.round(BASE_LARGE_BRUSH * Math.max(0.5, Math.min(2, arrowSizeScale)))) },
      });
      shapes.push({
        orig: makeSquare(to)!,
        brush: "paleBlue",
        modifiers: { lineWidth: Math.max(1, Math.round(BASE_LARGE_BRUSH * Math.max(0.5, Math.min(2, arrowSizeScale)))) },
      });
    } catch {}
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

  // Removed analyze/play toggle in pursuit of a unified experience

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
          <Tooltip label={`Take Back (${keyMap.TAKE_BACK.keys})`}>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => goToPrevious()}
            >
              <IconArrowBack />
            </ActionIcon>
          </Tooltip>
        )}
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
          label={`${t("Board.Action.FlipBoard", { key: keyMap.SWAP_ORIENTATION.keys })} · ${autoFlip ? "Auto-flip On" : "Auto-flip Off"} (double-click)`}
        >
          <ActionIcon
            variant={autoFlip ? "filled" : "default"}
            color={autoFlip ? "blue" : undefined}
            size="lg"
            onClick={() => toggleOrientation()}
            onDoubleClick={() => setAutoFlip((v) => !v)}
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
      disableVariations,
      saveFile,
      canTakeBack,
      toggleEditingMode,
      toggleOrientation,
      addGame,
      viewPawnStructure,
      t,
      eraseDrawablesOnClick,
      editingMode,
      currentTab?.file,
    ],
  );

  // Pass controls to parent if external controls are requested
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady(controls);
    }
  }, [onControlsReady, controls]);
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

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<number | null>(null);
  const [boardRenderKey, setBoardRenderKey] = useState<number>(0);

  useLayoutEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // compute square size: min(paneHeight, paneWidth)
      const size = Math.max(0, Math.min(el.clientWidth, el.clientHeight));
      try {
        const rect = el.getBoundingClientRect();
        // eslint-disable-next-line no-console
        console.info("[Board] container ResizeObserver", {
          size,
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          top: Math.round(rect.top),
        });
      } catch {}
      setBoardSize(size);
      // Force a full remount of Chessground so it recalculates bounds
      setBoardRenderKey((k) => k + 1);
    });
    ro.observe(el);
    // initial
    const size = Math.max(0, Math.min(el.clientWidth, el.clientHeight));
    setBoardSize(size);
    setBoardRenderKey((k) => k + 1);
    return () => ro.disconnect();
  }, []);

  // Force a redraw/remount when the parent requests it (e.g., analysis panel toggle or mosaic resize)
  useEffect(() => {
    if (redrawSeq === undefined) return;
    // eslint-disable-next-line no-console
    try { console.info("[Board] redrawSeq", redrawSeq); } catch {}
    setBoardRenderKey((k) => k + 1);
  }, [redrawSeq]);

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
            maxWidth: fitContainer
              ? "100%"
              :
              //            bottompadding                tabs                                  bottomb   evalbar                                gaps    ???
              "calc(100vh - var(--mantine-spacing-sm) - 2.778rem - var(--mantine-spacing-sm) - 2.125rem - 2.125rem + 1.563rem + var(--mantine-spacing-md) - 1rem  - 0.75rem)",
          }}
        >
          {materialDiff && (
            <Group ml="2.5rem" h="2.125rem">
              {/* {hasClock && (
                <Clock
                  color={orientation === "black" ? "white" : "black"}
                  turn={turn}
                  whiteTime={whiteTime}
                  blackTime={blackTime}
                />
              )} */}
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
              flex: 1,
              minHeight: 0,
            }}
            align="stretch"
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
            <Box style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box
                ref={boardContainerRef}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
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
                  style={{
                    width: boardSize ? `${boardSize}px` : undefined,
                    height: boardSize ? `${boardSize}px` : undefined,
                    // Allow live control of arrow opacity via CSS var consumed in chessgroundBaseOverride.css
                    ["--arrow-opacity" as any]: String(Math.max(0, Math.min(1, arrowOpacity))),
                    ...(isBasicAnnotation(currentNode.annotations[0])
                      ? {
                          "--light-color": lightColor,
                          "--dark-color": darkColor,
                        } as React.CSSProperties
                      : {}),
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
                    key={boardRenderKey}
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
              </Box>
            </Box>
          </Group>
          <Group justify="space-between" h="2.125rem">
            {materialDiff && (
              <Group ml="2.5rem">
                {/* {hasClock && (
                  <Clock
                    color={orientation}
                    turn={turn}
                    whiteTime={whiteTime}
                    blackTime={blackTime}
                  />
                )} */}
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

            {!externalControls && controls}
          </Group>
        </Box>
      </Box>
    </>
  );
}

export default memo(Board);
