import { events } from "@/bindings";
import {
  activeTabAtom,
  autoStartAnalysisAtom,
  currentEnginePausedAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  lastMovedAtom,
  tabsAtom,
  allEnabledAtom,
  enableAllAtom,
  currentTabAtom,
  showArrowsAtom,
} from "@/state/atoms";
import { getMainLine, getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { type GameHeaders, treeIteratorMainLine, getNodeAtPath } from "@/utils/treeReducer";
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
} from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { parseUci, squareFile, squareRank } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue, useSetAtom, atom } from "jotai";
import { useContext, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { MosaicWithoutDragDropContext as Mosaic, type MosaicNode } from "react-mosaic-component";
import { atomWithStorage } from "jotai/utils";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";
// import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
import Board from "./Board";
import EvalListener from "./EvalListener";
import BotService from "./BotService";
import { playersAtom as savedPlayersAtom, botsAtom as savedBotsAtom } from "@/state/atoms";
import type { Player } from "@/utils/players";
import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";

// NEW imports for nested mosaic playing layout
import AnalysisBar from "../panels/analysis/AnalysisBar";
import { loadable } from "jotai/utils";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import { activeTabAtom as activeTabForUnified } from "@/state/atoms";
import type { PiecesCount } from "@/utils/chess";
import PlayerPanel from "./PlayerPanel";
import { playedMovesFamily } from "@/state/playedMoves";
import type { UnifiedMove } from "@/state/unifiedMoves";
import type { OpponentSettings } from "./types";
import { normalizeScore } from "@/utils/score";

// NEW: Nested mosaic state for playing layout
type PlayingViewId =
  | "top"
  | "bottom"
  | "leftPlayer"
  | "centerBoard"
  | "rightPlayer"
  | "analysis"
  | "linesTree"
  | "unifiedMoves";

interface PlayingLayoutState {
  currentNode: MosaicNode<PlayingViewId> | null;
}

const DEFAULT_PLAYING_LAYOUT: MosaicNode<PlayingViewId> = {
  direction: "column",
  first: {
    direction: "row",
    first: "leftPlayer",
    second: {
      direction: "row",
      first: "centerBoard",
      second: "rightPlayer",
      splitPercentage: 72,
    },
    splitPercentage: 22,
  },
  second: "analysis",
  splitPercentage: 70,
};

const playingLayoutAtom = atomWithStorage<PlayingLayoutState>("playingLayoutState", {
  currentNode: DEFAULT_PLAYING_LAYOUT,
});

// (Removed) Previously used for show/hide analysis toggle

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const currentTab = useAtomValue(currentTabAtom);
  const isAnalysisTab = currentTab?.type === "analysis";

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const position = useStore(store, (s) => s.position);
  const currentNode = useStore(store, (s) => s.currentNode());
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const setResult = useStore(store, (s) => s.setResult);
  const appendMove = useStore(store, (s) => s.appendMove);

  const setLastMove = useSetAtom(lastMovedAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const setWhitePlayed = useSetAtom(playedMovesFamily({ tab: activeTab!, color: "white" }));
  const setBlackPlayed = useSetAtom(playedMovesFamily({ tab: activeTab!, color: "black" }));
  const whitePlayed = useAtomValue(playedMovesFamily({ tab: activeTab!, color: "white" }));
  const blackPlayed = useAtomValue(playedMovesFamily({ tab: activeTab!, color: "black" }));

  const boardRef = useRef(null);
  const botTimeoutRef = useRef<number | null>(null);
  const [gameState, setGameState] = useAtom(currentGameStateAtom);
  const [enginePaused, setEnginePaused] = useAtom(currentEnginePausedAtom);
  const [showArrows, setShowArrows] = useAtom(showArrowsAtom);
  const autoStartAnalysis = useAtomValue(autoStartAnalysisAtom);
  const [, enableAnalysisEngines] = useAtom(enableAllAtom);

  // Unified mode: no switching to a separate analysis tab type
  const mainLine = Array.from(treeIteratorMainLine(root));
  const lastNode = mainLine[mainLine.length - 1].node;
  const moves = useMemo(
    () => getMainLine(root, headers.variant === "Chess960"),
    [root, headers],
  );

  const [pos, error] = useMemo(() => {
    return positionFromFen(lastNode.fen);
  }, [lastNode.fen]);

  const [players, setPlayers] = useAtom(currentPlayersAtom);
  const [savedPlayers, setSavedPlayers] = useAtom(savedPlayersAtom);
  const [savedBots, setSavedBots] = useAtom(savedBotsAtom);

  const activeTabForBot = useAtomValue(activeTabForUnified);
  const isBotTurn = useMemo(() => {
    if (!pos) return false;
    const p = pos.turn === "white" ? players.white : players.black;
    return p.type === "engine" && p.engine == null; // our Bot (no separate engine)
  }, [pos, players]);

  const unifiedAtomForBot = useMemo(() => {
    const is960 = headers.variant === "Chess960";
    const currentMoves = getMainLine(root, is960);
    const base = pos
      ? unifiedMovesFamily({ rootFen: root.fen, fen: lastNode.fen, moves: currentMoves, tab: activeTabForBot! })
      : atom<UnifiedMove[]>([]);
    return loadable(base as any);
  }, [pos, headers.variant, root, lastNode.fen, activeTabForBot]);
  const unifiedLoadable = useAtomValue(unifiedAtomForBot);

  // Unified moves for the previous position (before the current move)
  const prevNode = position.length > 0 ? getNodeAtPath(root, position.slice(0, -1)) : null;
  const unifiedPrevAtom = useMemo(() => {
    const is960 = headers.variant === "Chess960";
    const currentMoves = getVariationLine(root, position.slice(0, -1), is960, false);
    const base = prevNode
      ? unifiedMovesFamily({ rootFen: root.fen, fen: prevNode.fen, moves: currentMoves, tab: activeTabForBot! })
      : atom<UnifiedMove[]>([]);
    return loadable(base as any);
  }, [prevNode?.fen, headers.variant, root, position, activeTabForBot]);
  const unifiedPrevLoadable = useAtomValue(unifiedPrevAtom);

  // Compute comparison for previously played move vs best available at that time
  const prevMoveComparison = useMemo(() => {
    try {
      if (unifiedPrevLoadable.state !== "hasData") return null;
      const list = (unifiedPrevLoadable.data || []) as UnifiedMove[];
      const san = (currentNode as any)?.san as string | undefined;
      const half = (currentNode as any)?.halfMoves as number | undefined;
      if (!san || typeof half !== "number" || half <= 0) return null;
      const colorPlayed: "white" | "black" = half % 2 === 1 ? "white" : "black";
      const actual = list.find((m) => (m.san || m.move) === san);
      const best = list.find((m) => m.isBest) || list.find((m) => m.score);
      // helper to convert square index to algebraic name
      const toSq = (sq: number | undefined) => {
        if (typeof sq !== "number") return undefined as unknown as string;
        const f = squareFile(sq);
        const r = squareRank(sq);
        return `${String.fromCharCode("a".charCodeAt(0) + f)}${r + 1}`;
      };
      // Build tiny preview from previous position and SAN
      const buildPreview = (prevFen: string, moveSan: string | undefined) => {
        if (!moveSan) return undefined as unknown as { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
        const [p0] = positionFromFen(prevFen);
        if (!p0) return undefined as any;
        const mv = parseSan(p0, moveSan) as any;
        if (!mv) return undefined as any;
        const from: any = mv.from;
        const to: any = mv.to;
        p0.play(mv as any);
        const fenAfter = makeFen(p0.toSetup());
        const lastMove = [toSq(from), toSq(to)].filter(Boolean) as string[];
        const isCheck = p0.isCheck();
        const turnColor: "white" | "black" = p0.turn;
        try {
          // eslint-disable-next-line no-console
          // console.info("[PlayerPanel Preview]", { moveSan, lastMove, fenAfter, isCheck, turnColor });
        } catch {}
        return { fen: fenAfter, lastMove, isCheck, turnColor };
      };
      const prevFen = prevNode?.fen as string | undefined;
      const actualPreview = prevFen ? buildPreview(prevFen, san) : undefined;
      const bestPreview = prevFen ? buildPreview(prevFen, best ? (best.san || best.move) : undefined) : undefined;
      return {
        color: colorPlayed,
        playedSan: san,
        actualMoveInfo: actual,
        bestMoveInfo: best,
        actualPreview,
        bestPreview,
      } as const;
    } catch {
      return null;
    }
  }, [unifiedPrevLoadable, currentNode?.san, currentNode?.halfMoves, prevNode?.fen]);

  // Persist last known prev-move info per side to avoid flicker and keep it visible until that side moves again
  const [prevInfoWhite, setPrevInfoWhite] = useState<{
    playedSan?: string;
    actualMoveInfo?: UnifiedMove;
    bestMoveInfo?: UnifiedMove;
    actualPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
    bestPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
  } | undefined>(undefined);
  const [prevInfoBlack, setPrevInfoBlack] = useState<{
    playedSan?: string;
    actualMoveInfo?: UnifiedMove;
    bestMoveInfo?: UnifiedMove;
    actualPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
    bestPreview?: { fen: string; lastMove: string[]; isCheck: boolean; turnColor: "white" | "black" };
  } | undefined>(undefined);

  useEffect(() => {
    if (!prevMoveComparison) return;
    if (prevMoveComparison.color === "white") {
      setPrevInfoWhite({
        playedSan: prevMoveComparison.playedSan,
        actualMoveInfo: prevMoveComparison.actualMoveInfo as any,
        bestMoveInfo: prevMoveComparison.bestMoveInfo as any,
        actualPreview: prevMoveComparison.actualPreview as any,
        bestPreview: prevMoveComparison.bestPreview as any,
      });
    } else {
      setPrevInfoBlack({
        playedSan: prevMoveComparison.playedSan,
        actualMoveInfo: prevMoveComparison.actualMoveInfo as any,
        bestMoveInfo: prevMoveComparison.bestMoveInfo as any,
        actualPreview: prevMoveComparison.actualPreview as any,
        bestPreview: prevMoveComparison.bestPreview as any,
      });
    }
  }, [prevMoveComparison]);

  // Ensure any move made via external UI (e.g., GameNotation click) is reflected in Played Moves
  useEffect(() => {
    if (gameState !== "playing") return;
    const san = (currentNode as any)?.san as string | undefined;
    const half = (currentNode as any)?.halfMoves as number | undefined;
    if (!san || typeof half !== 'number' || half <= 0) return;
    const color: "white" | "black" = (half % 2 === 1) ? "white" : "black";
    const moveNumber = Math.ceil(half / 2);
    const prevFen = prevNode?.fen as string | undefined;
    const contextHalfMoves = typeof half === 'number' ? Math.max(0, half - 1) : undefined;
    const list = color === "white" ? whitePlayed : blackPlayed;
    const exists = list.some((m: any) => (m.san || m.move) === san && m.moveNumber === moveNumber);
    // debug log removed for performance
    if (exists) return;
    try {
      const unifiedList: UnifiedMove[] = unifiedPrevLoadable.state === 'hasData' ? (unifiedPrevLoadable.data as UnifiedMove[]) : [];
      const found = unifiedList.find((m) => (m.san || m.move) === san);
      const setter = color === "white" ? setWhitePlayed : setBlackPlayed;
      setter((prev) => {
        const replacement: any = found
          ? { ...found, moveNumber, contextFen: prevFen, contextHalfMoves }
          : { move: san, san, rank: (prev.length + 1), source: 'database', moveNumber, contextFen: prevFen, contextHalfMoves };
        const idx = prev.findIndex((m: any) => m.moveNumber === moveNumber);
        if (idx >= 0) {
          const keepRank = (prev[idx] as any)?.rank;
          const next = [...prev];
          next[idx] = { ...replacement, rank: keepRank ?? replacement.rank } as any;
          // debug log removed for performance
          return next;
        }
        // debug log removed for performance
        return [...prev, replacement];
      });
    } catch {}
  }, [gameState, lastNode?.san, lastNode?.halfMoves, prevNode?.fen, whitePlayed, blackPlayed, unifiedPrevLoadable, setWhitePlayed, setBlackPlayed]);

  // Enrich last played move entry when engine/database data arrives later
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (unifiedPrevLoadable.state !== 'hasData') return;
    const san = (currentNode as any)?.san as string | undefined;
    const half = (currentNode as any)?.halfMoves as number | undefined;
    if (!san || typeof half !== 'number' || half <= 0) return;
    const color: 'white' | 'black' = (half % 2 === 1) ? 'white' : 'black';
    const moveNumber = Math.ceil(half / 2);
    const list = color === 'white' ? whitePlayed : blackPlayed;
    const idx = list.findIndex((m: any) => m.moveNumber === moveNumber);
    if (idx < 0) return;
    const foundList: UnifiedMove[] = (unifiedPrevLoadable.data as UnifiedMove[]) || [];
    const found = foundList.find((m) => (m.san || m.move) === san);
    if (!found) return;
    const needsEnrich = (() => {
      const row: any = list[idx] as any;
      // If score or pv/sanMoves missing, enrich
      const hasScore = !!row?.score;
      const hasLine = (Array.isArray(row?.pv) && row.pv.length > 0) || (Array.isArray(row?.sanMoves) && row.sanMoves.length > 0);
      return !hasScore || !hasLine || row?.engineName !== found.engineName;
    })();
    if (!needsEnrich) return;
    const setter = color === 'white' ? setWhitePlayed : setBlackPlayed;
    setter((prev) => {
      const i = prev.findIndex((m: any) => m.moveNumber === moveNumber);
      if (i < 0) return prev;
      const keep = prev[i] as any;
      const next = [...prev];
      next[i] = { ...keep, ...found, moveNumber: keep.moveNumber, contextFen: keep.contextFen, contextHalfMoves: keep.contextHalfMoves } as any;
      // debug log removed for performance
      return next;
    });
  }, [gameState, unifiedPrevLoadable, currentNode?.san, currentNode?.halfMoves, whitePlayed, blackPlayed, setWhitePlayed, setBlackPlayed]);

  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);

  useEffect(() => {
    // Clear any pending bot move when position changes
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
  }, [lastNode.fen, pos?.turn]);

  useEffect(() => {
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
      // Only auto-play from engine events if the current player is an actual engine (not bot)
      const currentPlayer = pos?.turn === "white" ? players.white : players.black;
      const allowEngineAutoplay = currentPlayer?.type === "engine" && (currentPlayer as any).engine;
      if (!allowEngineAutoplay) return;
      const ev = payload.bestLines;
      if (
        payload.progress === 100 &&
        payload.engine === pos?.turn &&
        payload.tab === activeTab + pos.turn &&
        payload.fen === root.fen &&
        equal(payload.moves, moves) &&
        !pos?.isEnd()
      ) {
        const move = parseUci(ev[0].uciMoves[0])!;
        appendMove({
          payload: move,
          clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined,
        });
        setLastMove(ev[0].uciMoves[0]);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [activeTab, appendMove, pos, root.fen, moves, whiteTime, blackTime, players]);

  const movable = useMemo(() => {
    if (players.white.type === "human" && players.black.type === "human") {
      return "turn";
    }
    if (players.white.type === "human") {
      return "white";
    }
    if (players.black.type === "human") {
      return "black";
    }
    return "none";
  }, [players]);

  const [enableAnalysisOnStart, setEnableAnalysisOnStart] = useState(autoStartAnalysis);

  useEffect(() => {
    setEnableAnalysisOnStart(autoStartAnalysis);
  }, [autoStartAnalysis]);

  // Ensure engines are enabled during setup if auto-start is on, so arrows appear immediately
  useEffect(() => {
    if (enableAnalysisOnStart) {
      enableAnalysisEngines(true);
    }
  }, [enableAnalysisOnStart]);

  // Start only after first move is made: detect first move from tree
  useEffect(() => {
    if (gameState !== "settingUp") return;
    const half = (lastNode as any)?.halfMoves as number | undefined;
    if (typeof half === "number" && half > 0) {
      startGame();
    }
  }, [gameState, lastNode?.halfMoves]);

  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // Track captured pieces per side from Board
  const [captured, setCaptured] = useState<{ white: PiecesCount; black: PiecesCount}>({
    white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  });
  const [materialDiff, setMaterialDiff] = useState(0);
  
  // Store board controls from Board component
  const [boardControls, setBoardControls] = useState<JSX.Element | null>(null);

  useEffect(() => {
    // reset captured when resetting game
    if (gameState === "settingUp") {
      setCaptured({ white: { p: 0, n: 0, b: 0, r: 0, q: 0 }, black: { p: 0, n: 0, b: 0, r: 0, q: 0 } });
      setMaterialDiff(0);
    }
  }, [gameState]);

  useEffect(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [pos?.turn]);

  useEffect(() => {
    if (gameState !== "playing") return;
    // Wait until both players are initialized to avoid placeholder header thrash
    if (!players?.white?.type || !players?.black?.type) return;
    const whiteName = players.white.type === "human" ? "Player" : (players.white as any).engine?.name ?? "?";
    const blackName = players.black.type === "human" ? "Player" : (players.black as any).engine?.name ?? "?";
    if (headers.white === whiteName && headers.black === blackName) return;
    setHeaders({ ...headers, white: whiteName, black: blackName });
  }, [players, headers, gameState]);

  useEffect(() => {
    if (gameState !== "playing" || enginePaused) {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [gameState, enginePaused, intervalId]);

  // ELO update on game end
  useEffect(() => {
    if (!pos) return;
    if (headers.result === "*") return;
    if (gameState !== "playing") return;

    // Determine scores: 1 for win, 0 for loss, 0.5 for draw from White's perspective
    let scoreWhite = 0.5;
    if (headers.result === "1-0") scoreWhite = 1;
    else if (headers.result === "0-1") scoreWhite = 0;
    const scoreBlack = 1 - scoreWhite;

    type Side = "white" | "black";
    const sides: Side[] = ["white", "black"];

    const getDisplayElo = (side: Side): number => {
      const opp = players[side];
      const isBot = opp.type === "engine" && (opp as any).engine == null;
      if (isBot) {
        const b = savedBots.find((bb) => bb.id === (opp as any).botId);
        const base = (opp as any).elo ?? b?.elo ?? 1500;
        const earned = (b as any)?.earnedELO ?? base;
        return earned;
      }
      // human
      const pid = (opp as any).playerId as string | undefined;
      const p = pid ? savedPlayers.find((pp) => pp.id === pid) : undefined;
      const base = (opp as any).elo ?? p?.elo ?? 1500;
      const earned = (p as any)?.earnedELO ?? base;
      return earned;
    };

    const K_FACTOR = 32;
    const expectedScore = (ra: number, rb: number) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

    const rWhite = getDisplayElo("white");
    const rBlack = getDisplayElo("black");
    const expWhite = expectedScore(rWhite, rBlack);
    const expBlack = expectedScore(rBlack, rWhite);

    const clamp = (v: number) => Math.max(400, Math.min(3600, v));
    const newWhite = clamp(Math.round(rWhite + K_FACTOR * (scoreWhite - expWhite)));
    const newBlack = clamp(Math.round(rBlack + K_FACTOR * (scoreBlack - expBlack)));

    // Persist to saved players/bots if linked
    const applyFor = (side: Side, newRating: number) => {
      const opp = players[side];
      const isBot = opp.type === "engine" && (opp as any).engine == null;
      if (isBot) {
        const id = (opp as any).botId as string | undefined;
        if (!id) return;
        setSavedBots((prev) => prev.map((b) => (b.id === id ? ({ ...b, earnedELO: newRating } as any) : b)));
        return;
      }
      const pid = (opp as any).playerId as string | undefined;
      if (!pid) return;
      setSavedPlayers((prev) => prev.map((p) => (p.id === pid ? ({ ...p, earnedELO: newRating } as Player) : p)));
    };

    applyFor("white", newWhite);
    applyFor("black", newBlack);

    // move to game over state once ratings applied
    setGameState("gameOver");
  }, [headers.result, gameState]);

  function decrementTime() {
    if (gameState === "playing") {
      if (pos?.turn === "white" && whiteTime !== null) {
        setWhiteTime((prev) => prev! + 100);
      } else if (pos?.turn === "black" && blackTime !== null) {
        setBlackTime((prev) => prev! + 100);
      }
    }
  }

  function startGame() {
    setGameState("playing");

    // Initialize clocks to 0 (count-up)
    setWhiteTime(0);
    setBlackTime(0);

    // Reset previous move info panels
    setPrevInfoWhite(undefined);
    setPrevInfoBlack(undefined);

    const defaultPlayers: { white: OpponentSettings; black: OpponentSettings } = {
      white: { type: "human", name: "Player", timeControl: undefined },
      black: { type: "human", name: "Player", timeControl: undefined },
    };
    setPlayers(defaultPlayers);

    const newHeaders: Partial<GameHeaders> = {
      white: "Player",
      black: "Player",
      time_control: undefined,
    };

    setHeaders({
      ...headers,
      ...newHeaders,
      fen: root.fen,
    });

    setTabs((prev) =>
      prev.map((tab) => {
        return tab.value === activeTab
          ? {
              ...tab,
              name: `Player vs. Player`,
            }
          : tab;
      }),
    );

    if (enableAnalysisOnStart) {
      enableAnalysisEngines(true);
    }
  }

  // Auto-start Human vs Human game (and timers) on new/play tabs
  useEffect(() => {
    if ((currentTab?.type === "play" || currentTab?.type === "new") && gameState === "settingUp") {
      startGame();
    }
  }, [currentTab?.type, gameState]);

  useEffect(() => {
    if (gameState === "playing" && !enginePaused && !intervalId) {
      const intervalId = setInterval(decrementTime, 100);
      setIntervalId(intervalId);
    }
  }, [gameState, enginePaused, intervalId, pos?.turn]);

  const onePlayerIsEngine =
    (players.white.type === "engine" || players.black.type === "engine") &&
    players.white.type !== players.black.type;

  // NEW: nested mosaic state for playing
  const [playingLayoutState, setPlayingLayoutState] = useAtom(playingLayoutAtom);
  // (Removed) analysis open/close state

  // Track size changes of the center board container and force Board/Chessground remount
  const centerBoardRef = useRef<HTMLDivElement | null>(null);
  const [redrawSeq, setRedrawSeq] = useState(0);

  useLayoutEffect(() => {
    const el = centerBoardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      try {
        const rect = el.getBoundingClientRect();
        // eslint-disable-next-line no-console
        console.info("[BoardGame] centerBoard ResizeObserver", {
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        });
      } catch {}
      setRedrawSeq((s) => s + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (Removed) analysis open/close redraw nudge

  // Normalize any persisted layout: remove deprecated views and ensure an 'analysis' pane exists
  const pruneLayout = useMemo(() => {
    const removeDeprecated = (node: MosaicNode<PlayingViewId> | null): MosaicNode<PlayingViewId> | null => {
      if (!node) return null;
      if (typeof node === "string") {
        return node === "linesTree" || node === "unifiedMoves" ? null : node;
      }
      const first = removeDeprecated(node.first as any);
      const second = removeDeprecated(node.second as any);
      if (first && second) return { ...(node as any), first, second };
      if (first) return first;
      if (second) return second;
      return null;
    };

    const contains = (node: MosaicNode<PlayingViewId> | null, tile: PlayingViewId): boolean => {
      if (!node) return false;
      if (typeof node === "string") return node === tile;
      return contains(node.first as any, tile) || contains(node.second as any, tile);
    };

    const cleaned = removeDeprecated(playingLayoutState.currentNode);
    if (!cleaned) return DEFAULT_PLAYING_LAYOUT;
    if (contains(cleaned, "analysis")) return cleaned;
    // Inject analysis below existing layout when missing
    return {
      direction: "column",
      first: cleaned,
      second: "analysis",
      splitPercentage: 70,
    } as any;
  }, [playingLayoutState.currentNode]);

  // NEW: Define nested mosaic tile renderers for unified playing view
  const playingTiles: { [viewId in PlayingViewId]: JSX.Element } = {
    leftPlayer: (
      <PlayerPanel
        color="white"
        opponent={players.white}
        setOpponent={(updater) =>
          setPlayers((prev) => {
            const next =
              typeof updater === "function"
                ? { ...prev, white: (updater as any)(prev.white) }
                : { ...prev, white: updater };
            return next;
          })
        }
        setOtherOpponent={(updater) =>
          setPlayers((prev) => {
            const nextOther =
              typeof updater === "function" ? (updater as any)(prev.black) : updater;
            return { ...prev, black: nextOther } as any;
          })
        }
        whiteTime={whiteTime}
        blackTime={blackTime}
        turn={pos?.turn}
        captured={captured.white}
        materialDiff={materialDiff}
        prevMoveInfo={prevInfoWhite}
      />
    ),
    centerBoard: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Box style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box ref={centerBoardRef} style={{ height: "100%", maxWidth: "100%", aspectRatio: "1 / 1", display: "flex", minWidth: 0, minHeight: 0 }}>
            <Board
              dirty={false}
              editingMode={false}
              toggleEditingMode={() => undefined}
              viewOnly={false}
              boardRef={boardRef}
              canTakeBack={true}
              movable={gameState === "settingUp" ? "turn" : movable}
              whiteTime={gameState === "playing" ? (whiteTime ?? undefined) : undefined}
              blackTime={gameState === "playing" ? (blackTime ?? undefined) : undefined}
              fitContainer
              externalControls={true}
              onControlsReady={setBoardControls}
              onCapturedChange={setCaptured}
              onMaterialDiffChange={setMaterialDiff}
              redrawSeq={redrawSeq}
            />
          </Box>
        </Box>
        {/* Global controls affecting both players */}
        <Group mt="sm" gap="sm" justify="space-between">
          <Group gap="sm">
            <Button
              onClick={() => setEnginePaused((prev) => !prev)}
              leftSection={enginePaused ? <IconPlayerPlay /> : <IconPlayerStop />}
              variant="default"
            >
              {enginePaused ? "Play" : "Pause"}
            </Button>
            <Button
              onClick={() => setShowArrows((prev) => !prev)}
              variant={showArrows ? "filled" : "default"}
            >
              {showArrows ? "Arrows On" : "Arrows Off"}
            </Button>
          </Group>
          {boardControls && (
            <Box>
              {boardControls}
            </Box>
          )}
        </Group>
      </Paper>
    ),
    rightPlayer: (
      <PlayerPanel
        color="black"
        opponent={players.black}
        setOpponent={(updater) =>
          setPlayers((prev) => {
            const next =
              typeof updater === "function"
                ? { ...prev, black: (updater as any)(prev.black) }
                : { ...prev, black: updater };
            return next;
          })
        }
        setOtherOpponent={(updater) =>
          setPlayers((prev) => {
            const nextOther =
              typeof updater === "function" ? (updater as any)(prev.white) : updater;
            return { ...prev, white: nextOther } as any;
          })
        }
        whiteTime={whiteTime}
        blackTime={blackTime}
        turn={pos?.turn}
        captured={captured.black}
        materialDiff={materialDiff}
        prevMoveInfo={prevInfoBlack}
      />
    ),
    analysis: (
      <Box h={300}>
        <AnalysisBar height={"100%"} />
      </Box>
    ),
    // Keep placeholders for backward-compatible persisted layouts; do not render analysis widgets here
    linesTree: (<Box h="100%" />),
    unifiedMoves: (<Box h="100%" />),
    // These are placeholders to satisfy the type; not used directly as root children
    top: <Box h="100%" />,
    bottom: <Box h="100%" />,
  };

  return (
    <>
      <EvalListener />
      <BotService />
      <Box style={{ height: "100%", padding: "8px", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <Mosaic<PlayingViewId>
            renderTile={(id) => playingTiles[id]}
            value={pruneLayout}
            onChange={(currentNode) => {
              setPlayingLayoutState({ currentNode: (currentNode as any) ?? DEFAULT_PLAYING_LAYOUT });
              // schedule redraw after mosaic panes resize
              requestAnimationFrame(() => {
                try {
                  const rect = centerBoardRef.current?.getBoundingClientRect();
                  // eslint-disable-next-line no-console
                  console.info("[BoardGame] Mosaic onChange nudge", rect ? {
                    w: Math.round(rect.width),
                    h: Math.round(rect.height),
                    top: Math.round(rect.top),
                  } : null);
                } catch {}
                setRedrawSeq((s) => s + 1);
              });
            }}
            resize={{ minimumPaneSizePercentage: 10 }}
          />
        </Box>
      </Box>
    </>
  );
}

export default BoardGame;
