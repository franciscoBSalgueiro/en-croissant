import { events, commands } from "@/bindings";
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
} from "@/state/atoms";
import { getMainLine, getVariationLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { type GameHeaders, treeIteratorMainLine, getNodeAtPath } from "@/utils/treeReducer";
import { Box, ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
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
import { playersAtom as savedPlayersAtom, botsAtom as savedBotsAtom, defaultPlayerIdAtom } from "@/state/atoms";
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
import { getBotvinnikDbPath } from "@/utils/db";
import type { OpponentSettings } from "./types";
import { normalizeScore } from "@/utils/score";
import { getPGN } from "@/utils/chess";
import { historyAtom, type HistoryEntry } from "@/state/atoms";
import BoardControls from "@/components/boards/BoardControls";

// NEW: Nested mosaic state for playing layout
type PlayingViewId =
  | "top"
  | "bottom"
  | "leftPlayer"
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
    second: "rightPlayer",
    splitPercentage: 50,
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
  const pushHistory = useSetAtom(historyAtom);

  const boardRef = useRef(null);
  const botTimeoutRef = useRef<number | null>(null);
  const [gameState, setGameState] = useAtom(currentGameStateAtom);
  const [enginePaused, setEnginePaused] = useAtom(currentEnginePausedAtom);
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
  const defaultPlayerId = useAtomValue(defaultPlayerIdAtom);

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
      // compute elapsed since previous ply on this side using cumulative timers
      const elapsedMs = color === 'white'
        ? Math.max(0, (whiteTime ?? 0) - whiteCumulRef.current)
        : Math.max(0, (blackTime ?? 0) - blackCumulRef.current);
      if (color === 'white') whiteCumulRef.current = (whiteTime ?? 0); else blackCumulRef.current = (blackTime ?? 0);
      setter((prev) => {
        const replacement: any = found
          ? { ...found, moveNumber, contextFen: prevFen, contextHalfMoves, elapsedMs }
          : { move: san, san, rank: (prev.length + 1), source: 'database', moveNumber, contextFen: prevFen, contextHalfMoves, elapsedMs };
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
  const whiteCumulRef = useRef(0);
  const blackCumulRef = useRef(0);

  // Helper function to generate event name based on time control
  function getTimeControlEvent(headers: GameHeaders): string {
    const whiteTC = headers.white_time_control;
    const blackTC = headers.black_time_control;
    const generalTC = headers.time_control;
    
    // Use white time control if set, fall back to general or black
    const tc = whiteTC || generalTC || blackTC;
    
    if (!tc) return "Unlimited Game";
    
    // Parse time control like "300+0" or "900+10"
    const match = tc.match(/^(\d+)(?:\+(\d+))?$/);
    if (!match) return `${tc} Game`;
    
    const seconds = parseInt(match[1]);
    const increment = parseInt(match[2] || "0");
    const minutes = Math.floor(seconds / 60);
    
    if (increment > 0) {
      return `${minutes}+${increment} Game`;
    } else {
      return `${minutes} min Game`;
    }
  }

  useEffect(() => {
    // Clear any pending bot move when position changes
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
  }, [lastNode.fen, pos?.turn]);

  useEffect(() => {
    const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
    if (!isTauri) return;
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
      // unlisten is a promise resolving to a function in tauri-specta bindings
      (unlisten as any)?.then?.((f: any) => f?.());
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
    if (!players?.white?.type || !players?.black?.type) return;
    const resolveHumanName = (side: any) => {
      if (side.type !== "human") return undefined as string | undefined;
      const pid = (side as any).playerId as string | undefined;
      const p = pid ? savedPlayers.find((pp) => pp.id === pid) : undefined;
      return p?.name || "Human";
    };
    const resolveEngineName = (side: any) => {
      // If this is our built-in Bot (engine type but no external engine), show bot name
      if (side?.type === "engine" && !(side as any).engine) {
        const id = (side as any).botId as string | undefined;
        const b = id ? savedBots.find((bb) => bb.id === id) : undefined;
        return b?.name || "Bot";
      }
      return (side as any).engine?.name ?? "?";
    };
    const resolveElo = (side: any): number | undefined => {
      if (!side) return undefined;
      if (side.type === "human") {
        const pid = (side as any).playerId as string | undefined;
        const p = pid ? savedPlayers.find((pp) => pp.id === pid) : undefined;
        return (p as any)?.earnedELO ?? p?.elo ?? (side as any)?.elo;
      }
      if (side.type === "engine" && !(side as any).engine) {
        const id = (side as any).botId as string | undefined;
        const b = id ? savedBots.find((bb) => bb.id === id) : undefined;
        return (b as any)?.earnedELO ?? (b as any)?.elo ?? (side as any)?.elo;
      }
      return (side as any)?.elo;
    };
    const whiteName = players.white.type === "human"
      ? resolveHumanName(players.white)
      : resolveEngineName(players.white);
    const blackName = players.black.type === "human"
      ? resolveHumanName(players.black)
      : resolveEngineName(players.black);
    const whiteElo = resolveElo(players.white);
    const blackElo = resolveElo(players.black);
    const sameNames = headers.white === whiteName && headers.black === blackName;
    const sameElos = headers.white_elo === (whiteElo as any) && headers.black_elo === (blackElo as any);
    if (sameNames && sameElos) return;
    setHeaders({
      ...headers,
      white: whiteName || headers.white,
      black: blackName || headers.black,
      white_elo: (whiteElo as any) ?? headers.white_elo,
      black_elo: (blackElo as any) ?? headers.black_elo,
    });
  }, [
    players,
    savedPlayers,
    savedBots,
    headers.white,
    headers.black,
    headers.white_elo,
    headers.black_elo,
    gameState,
  ]);

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
        const list = Array.isArray(savedBots) ? savedBots : [];
        setSavedBots(list.map((b: any) => (b.id === id ? ({ ...b, earnedELO: newRating } as any) : b)) as any);
        return;
      }
      const pid = (opp as any).playerId as string | undefined;
      if (!pid) return;
      const list = Array.isArray(savedPlayers) ? savedPlayers : [];
      setSavedPlayers(list.map((p: any) => (p.id === pid ? ({ ...p, earnedELO: newRating } as Player) : p)) as any);
    };

    applyFor("white", newWhite);
    applyFor("black", newBlack);

    // move to game over state once ratings applied
    setGameState("gameOver");

    // Also record to history with accuracy and PGN
    try {
      const avg = (arr: any[]) => {
        const xs = arr.map((m: any) => m?.pctBest).filter((v: any) => typeof v === "number");
        if (xs.length === 0) return undefined as number | undefined;
        return xs.reduce((a: number, b: number) => a + b, 0) / xs.length;
        };
      const whiteAccuracy = avg(whitePlayed as any);
      const blackAccuracy = avg(blackPlayed as any);
      // Build complete PGN with headers and time per move embedded
      // Use the actual played path, not the tree mainline
      const actualPath = position; // current position when game ended
      
      // Generate custom PGN headers in the requested order
      const gameDate = headers.date || new Date().toISOString().split('T')[0].replace(/-/g, '.');
      const eventName = getTimeControlEvent(headers);
      
      const pgnHeaders = [
        `[White "${headers.white || "?"}"]`,
        `[Black "${headers.black || "?"}"]`,
        `[Date "${gameDate}"]`,
        `[Result "${headers.result || "*"}"]`,
        headers.white_elo ? `[WhiteElo "${headers.white_elo}"]` : null,
        headers.black_elo ? `[BlackElo "${headers.black_elo}"]` : null,
        `[Event "${eventName}"]`,
        `[Site "Botvinnik"]`,
        `[Round "${headers.round || "?"}"]`,
      ].filter(Boolean).join('\n');
      
      // Build timing-enhanced moves
      const formatClk = (ms: number | undefined) => {
        if (!Number.isFinite(ms as any)) return undefined;
        const s = Math.max(0, Math.floor((ms as number) / 1000));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${hh}:${pad(mm)}:${pad(ss)}`;
      };
      
      const actualMoves = getVariationLine(root, actualPath, headers.variant === "Chess960");
      const lines: string[] = [];
      
      for (let i = 0; i < actualMoves.length; i += 2) {
        const moveNum = i / 2 + 1;
        const whiteSan = (whitePlayed as any[])[i / 2]?.san || (whitePlayed as any[])[i / 2]?.move;
        const whiteClk = formatClk((whitePlayed as any[])[i / 2]?.elapsedMs);
        const blackSan = (blackPlayed as any[])[i / 2]?.san || (blackPlayed as any[])[i / 2]?.move;
        const blackClk = formatClk((blackPlayed as any[])[i / 2]?.elapsedMs);
        const w = whiteSan ? `${moveNum}. ${whiteSan}${whiteClk ? ` {[%clk ${whiteClk}]}` : ""}` : "";
        const b = blackSan ? ` ${blackSan}${blackClk ? ` {[%clk ${blackClk}]}` : ""}` : "";
        lines.push(`${w}${b}`.trim());
      }
      
      const timingBody = lines.join("\n");
      const resultTag = headers.result || "*";
      const pgn = `${pgnHeaders}\n\n${timingBody} ${resultTag}`;
      const movesCount = Math.ceil(((lastNode as any)?.halfMoves || 0) / 2);
      const unifiedSnapshot = [
        ...((whitePlayed as any[]) || []),
        ...((blackPlayed as any[]) || []),
      ];
      // capture ISO timestamp in case headers.date/utc_time are not present
      const isoNow = new Date().toISOString();
      // Persist PGN to Botvinnik DB (SQLite) via append_game
      (async () => {
        try {
          const botvinnikPath = await getBotvinnikDbPath();
          await (commands as any).appendGame(botvinnikPath, pgn);
        } catch {}
      })();

      pushHistory((prev: any) => [
        {
          white: headers.white || "White",
          black: headers.black || "Black",
          whiteElo: headers.white_elo as any,
          blackElo: headers.black_elo as any,
          result: headers.result as any,
          whiteAccuracy,
          blackAccuracy,
          moves: Number.isFinite(movesCount) ? movesCount : undefined,
          date: headers.date ? (headers.date as any) : isoNow,
          time: (headers as any).utc_time || new Date().toLocaleTimeString(),
          pgn,
          unifiedMainline: unifiedSnapshot,
        },
        ...((Array.isArray(prev) ? prev : []) as any[]),
      ]);
    } catch {}
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
    whiteCumulRef.current = 0;
    blackCumulRef.current = 0;

    const fallback = { id: "human", name: "Human", elo: 1500 } as any;
    const defaultPlayer = savedPlayers.find((p) => p.id === defaultPlayerId) || fallback;
    const defaultPlayers: { white: OpponentSettings; black: OpponentSettings } = {
      white: { type: "human", name: defaultPlayer.name, playerId: defaultPlayer.id, timeControl: undefined } as any,
      black: { type: "human", name: defaultPlayer.name, playerId: defaultPlayer.id, timeControl: undefined } as any,
    };
    setPlayers(defaultPlayers);

    const newHeaders: Partial<GameHeaders> = {
      white: defaultPlayer.name,
      black: defaultPlayer.name,
      white_elo: (defaultPlayer as any).earnedELO ?? defaultPlayer.elo,
      black_elo: (defaultPlayer as any).earnedELO ?? defaultPlayer.elo,
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
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [analysisSplit, setAnalysisSplit] = useState<number>(70);

  // Removed center board ResizeObserver; boards live inside each PlayerPanel

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

  // Apply collapse/expand by adjusting root split percentage when analysis present
  const layoutForMosaic: MosaicNode<PlayingViewId> = useMemo(() => {
    const node = pruneLayout;
    if (typeof node === 'string') return node;
    // We expect root to be a column with second = 'analysis'
    if ((node as any)?.direction === 'column' && (node as any)?.second === 'analysis') {
      const desired = analysisCollapsed ? 98 : analysisSplit;
      return { ...(node as any), splitPercentage: desired } as any;
    }
    return node;
  }, [pruneLayout, analysisCollapsed, analysisSplit]);

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
        movable={gameState === "settingUp" ? "turn" : movable}
        onCapturedChange={setCaptured}
        onMaterialDiffChange={setMaterialDiff}
      />
    ),
    // centerBoard removed in favor of embedded boards in each PlayerPanel
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
        movable={gameState === "settingUp" ? "turn" : movable}
        onCapturedChange={setCaptured}
        onMaterialDiffChange={setMaterialDiff}
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
          <Group justify="flex-end" mt={6} mb={6} style={{ position: 'fixed', bottom: 12, right: 24, zIndex: 1000 }}>
            <Tooltip label={analysisCollapsed ? "Expand analysis" : "Collapse analysis"}>
              <ActionIcon variant="default" onClick={() => setAnalysisCollapsed((v) => !v)}>
                {analysisCollapsed ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>
          <Mosaic<PlayingViewId>
            renderTile={(id) => playingTiles[id]}
            value={layoutForMosaic}
            onChange={(currentNode) => {
              setPlayingLayoutState({ currentNode: (currentNode as any) ?? DEFAULT_PLAYING_LAYOUT });
              // capture current split when not collapsed
              try {
                const n = (currentNode as any);
                if (n && typeof n === 'object' && n.direction === 'column' && n.second === 'analysis') {
                  const sp = typeof n.splitPercentage === 'number' ? n.splitPercentage : analysisSplit;
                  setAnalysisSplit(sp);
                }
              } catch {}
            }}
            resize={{ minimumPaneSizePercentage: 10 }}
          />
        </Box>
      </Box>
    </>
  );
}

export default BoardGame;
