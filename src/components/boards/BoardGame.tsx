import { events, type GoMode, commands } from "@/bindings";
import {
  activeTabAtom,
  autoStartAnalysisAtom,
  currentEnginePausedAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  enginesAtom,
  lastMovedAtom,
  tabsAtom,
  allEnabledAtom,
  enableAllAtom,
  currentTabAtom,
  botsAtom,
} from "@/state/atoms";
import { getMainLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import type { TimeControlField } from "@/utils/clock";
import type { LocalEngine } from "@/utils/engines";
import { type GameHeaders, treeIteratorMainLine } from "@/utils/treeReducer";
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  InputWrapper,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tabs,
} from "@mantine/core";
import {
  IconArrowsExchange,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
} from "@tabler/icons-react";
import { parseUci } from "chessops";
import { parseSan } from "chessops/san";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { atomWithStorage } from "jotai/utils";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import GameInfo from "../common/GameInfo";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import TimeInput from "../common/TimeInput";
import { TreeStateContext } from "../common/TreeStateContext";
// import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
import Board from "./Board";
import AnalysisPanel from "../panels/analysis/AnalysisPanel";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import InfoPanel from "../panels/info/InfoPanel";
import EvalListener from "./EvalListener";
import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";

// NEW imports for nested mosaic playing layout
import Clock from "./Clock";
import LinesTree from "../panels/analysis/LinesTree";
import UnifiedMovesTable from "../panels/analysis/UnifiedMovesTable";
import { loadable } from "jotai/utils";
import { unifiedMovesFamily } from "@/state/unifiedMoves";
import { activeTabAtom as activeTabForUnified } from "@/state/atoms";
import type { PiecesCount } from "@/utils/chess";

function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: LocalEngine | null;
  setEngine: (engine: LocalEngine | null) => void;
}) {
  const engines = useAtomValue(enginesAtom).filter(
    (e): e is LocalEngine => e.type === "local",
  );

  useEffect(() => {
    if (engines.length > 0 && engine === null) {
      setEngine(engines[0]);
    }
  }, [engine, engines[0], setEngine]);

  return (
    <Suspense>
      <Select
        label="Engine"
        allowDeselect={false}
        data={engines?.map((engine) => ({
          label: engine.name,
          value: engine.path,
        }))}
        value={engine?.path ?? ""}
        onChange={(e) => {
          setEngine(engines.find((engine) => engine.path === e) ?? null);
        }}
      />
    </Suspense>
  );
}

export type OpponentSettings =
  | {
      type: "human";
      timeControl?: TimeControlField;
      name?: string;
    }
  | {
      type: "engine";
      timeControl?: TimeControlField;
      engine: LocalEngine | null; // null means Bot mode
      go: GoMode;
      // Bot-specific fields (when engine is null)
      pickRank?: number;
      strategy?: { mode: "rank"; rank: number } | { mode: "randomTopN"; topN: number };
      botId?: string;
    };

function OpponentForm({
  opponent,
  setOpponent,
  setOtherOpponent,
  inline,
}: {
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  inline?: boolean;
}) {
  const bots = useAtomValue(botsAtom);
  const localEngines = useAtomValue(enginesAtom).filter(
    (e): e is LocalEngine => (e as any).type === "local",
  );

  const options = [
    { value: "human", label: "Human" },
    ...bots.map((b) => ({ value: b.id, label: b.name })),
  ];

  const findMatchingBotId = () => {
    if (opponent.type === "human") return "human";
    if ((opponent as any).botId) return (opponent as any).botId as string;
    if (opponent.engine) return undefined;
    // match by name if present, otherwise by strategy/pickRank
    const bot = bots.find((b) => {
      if (b.name && (opponent as any).name === b.name) return true;
      const rank = (opponent as any).strategy?.mode === "rank" ? (opponent as any).strategy.rank : (opponent as any).pickRank;
      const bRank = (b as any).strategy?.mode === "rank" ? (b as any).strategy.rank : (b as any).pickRank;
      return (rank ?? 1) === (bRank ?? 1);
    });
    return bot ? bot.id : undefined;
  };

  const currentValue = findMatchingBotId();

  const select = (
    <Select
      label={inline ? undefined : "Player"}
      placeholder="Select player"
      data={options}
      value={currentValue}
      onChange={(val) => {
        if (!val || val === "human") {
          setOpponent((prev) => ({
            ...prev,
            type: "human",
            name: "Player",
            timeControl: undefined,
            botId: undefined,
          }));
        } else {
          const bot = bots.find((b) => b.id === val);
          if (!bot) return;
          const strategy = bot.strategy || { mode: "rank", rank: bot.pickRank ?? 1 };
          setOpponent((prev) => ({
            ...(prev.type === "engine" ? prev : ({} as any)),
            type: "engine",
            engine:
              prev.type === "engine" && prev.engine
                ? prev.engine
                : null,
            pickRank: bot.pickRank,
            strategy: strategy as any,
            confThreshold: bot.confThreshold,
            thinkingDelayMinMs: bot.thinkingDelayMinMs,
            thinkingDelayMaxMs: bot.thinkingDelayMaxMs,
            timeControl: undefined,
            botId: bot.id,
          }));
        }
      }}
      style={{ flex: 1 }}
    />
  );

  if (inline) return select;

  return <Stack flex={1}>{select}</Stack>;
}

function PlayerPanel({
  color,
  opponent,
  setOpponent,
  setOtherOpponent,
  whiteTime,
  blackTime,
  turn,
  captured,
  materialDiff,
}: {
  color: "white" | "black";
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  whiteTime: number | null;
  blackTime: number | null;
  turn: "white" | "black" | undefined;
  captured: PiecesCount;
  materialDiff: number;
}) {
  const capturedSize = 25;
  const pieceColorChar = color === "white" ? "d" : "l"; // show black icons for white, white icons for black
  const srcFor = (role: keyof PiecesCount) => `/svg/Chess_${role}${pieceColorChar}l45.svg`;
  const renderCaptured = (c: PiecesCount) => {
    const items: JSX.Element[] = [];
    for (let i = 0; i < c.p; i++) items.push(<img key={`p${i}`} src={srcFor("p")} width={capturedSize} height={capturedSize} alt="pawn" />);
    for (let i = 0; i < c.n; i++) items.push(<img key={`n${i}`} src={srcFor("n")} width={capturedSize} height={capturedSize} alt="knight" />);
    for (let i = 0; i < c.b; i++) items.push(<img key={`b${i}`} src={srcFor("b")} width={capturedSize} height={capturedSize} alt="bishop" />);
    for (let i = 0; i < c.r; i++) items.push(<img key={`r${i}`} src={srcFor("r")} width={capturedSize} height={capturedSize} alt="rook" />);
    for (let i = 0; i < c.q; i++) items.push(<img key={`q${i}`} src={srcFor("q")} width={capturedSize} height={capturedSize} alt="queen" />);
    return <Group gap={0}>{items}</Group>;
  };

  const sideDiff = color === "white" ? materialDiff : -materialDiff;
  const diffLabel = sideDiff > 0 ? `+${sideDiff}` : sideDiff < 0 ? `${sideDiff}` : undefined;

  return (
    <Paper
      withBorder
      shadow="sm"
      p="md"
      h="100%"
      style={{
        minHeight: 300,
        overflow: "hidden",
        // backgroundColor: color === "white" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.8)",
        color: color === "white" ? "inherit" : "white",
      }}
    >
      <Stack gap="xs">
        <Group align="center" gap="xs">
          {color === "white" ? (
            <>
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
              <Clock color={color} turn={turn || "white"} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
            </>
          ) : (
            <>
              <Clock color={color} turn={turn || "white"} whiteTime={whiteTime ?? undefined} blackTime={blackTime ?? undefined} />
              <OpponentForm inline opponent={opponent} setOpponent={setOpponent} setOtherOpponent={setOtherOpponent} />
            </>
          )}
        </Group>
        <Group justify="space-between" w="100%">
          {renderCaptured(captured)}
          {diffLabel && <Text size="sm" fw={600}>{diffLabel}</Text>}
        </Group>
      </Stack>
    </Paper>
  );
}

const DEFAULT_TIME_CONTROL: TimeControlField = {
  seconds: 180_000,
  increment: 2_000,
};

// Board/Sidebar layout state
type BoardViewId = "board" | "sidebar";

interface BoardLayoutState {
  currentNode: MosaicNode<BoardViewId> | null;
}

const boardLayoutStateAtom = atomWithStorage<BoardLayoutState>("boardLayoutState", {
  currentNode: {
    direction: "row",
    first: "board",
    second: "sidebar",
    splitPercentage: 65, // Board takes 65% of width by default
  },
});

// NEW: Nested mosaic state for playing layout
type PlayingViewId =
  | "top"
  | "bottom"
  | "leftPlayer"
  | "centerBoard"
  | "rightPlayer"
  | "linesTree"
  | "unifiedMoves";

interface PlayingLayoutState {
  currentNode: MosaicNode<PlayingViewId> | null;
}

const playingLayoutAtom = atomWithStorage<PlayingLayoutState>("playingLayoutState", {
  currentNode: {
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
});

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const currentTab = useAtomValue(currentTabAtom);
  const isAnalysisTab = currentTab?.type === "analysis";

  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white",
  );
  function cycleColor() {
    setInputColor((prev) =>
      match(prev)
        .with("white", () => "black" as const)
        .with("black", () => "random" as const)
        .with("random", () => "white" as const)
        .exhaustive(),
    );
  }

  const [player1Settings, setPlayer1Settings] = useState<OpponentSettings>({
    type: "human",
    name: "Player",
    timeControl: undefined,
  });
  const [player2Settings, setPlayer2Settings] = useState<OpponentSettings>({
    type: "human",
    name: "Player",
    timeControl: undefined,
  });

  function getPlayers() {
    let white = inputColor === "white" ? player1Settings : player2Settings;
    let black = inputColor === "black" ? player1Settings : player2Settings;
    if (inputColor === "random") {
      white = Math.random() > 0.5 ? player1Settings : player2Settings;
      black = white === player1Settings ? player2Settings : player1Settings;
    }
    return { white, black };
  }

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const setResult = useStore(store, (s) => s.setResult);
  const appendMove = useStore(store, (s) => s.appendMove);

  const setLastMove = useSetAtom(lastMovedAtom);
  const [, setTabs] = useAtom(tabsAtom);

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

  const activeTabForBot = useAtomValue(activeTabForUnified);
  const isBotTurn = useMemo(() => {
    if (!pos) return false;
    const p = pos.turn === "white" ? players.white : players.black;
    return p.type === "engine" && p.engine == null; // our Bot (no separate engine)
  }, [pos, players]);

  const unifiedAtomForBot = useMemo(() => {
    if (!pos) return null;
    const is960 = headers.variant === "Chess960";
    const currentMoves = getMainLine(root, is960);
    return loadable(
      unifiedMovesFamily({ rootFen: root.fen, fen: lastNode.fen, moves: currentMoves, tab: activeTabForBot! })
    );
  }, [pos, headers.variant, root, lastNode.fen, activeTabForBot]);
  const unifiedLoadable = unifiedAtomForBot ? useAtomValue(unifiedAtomForBot) : { state: "loading" } as any;

  useEffect(() => {
    if (!pos) return;
    if (gameState !== "playing") return;
    if (enginePaused) return;
    if (headers.result !== "*") return;

    const currentTurn = pos.turn;
    const player = currentTurn === "white" ? players.white : players.black;

    // Bot logic: pick from unified moves if engine is null
    if (player.type === "engine" && player.engine == null) {
      if (unifiedLoadable.state !== "hasData") return;
      const movesList = (unifiedLoadable.data || []) as any[];
      if (!movesList || movesList.length === 0) return;
      const strat = (player as any).strategy as any | undefined;
      const confThreshold: number | undefined = (player as any).confThreshold;

      // Optionally filter by confidence threshold, but fall back to full list if empty
      const basePool: any[] = Array.isArray(movesList) ? movesList : [];
      const filteredByConf =
        typeof confThreshold === "number"
          ? basePool.filter((m) => typeof m.confidence === "number" && m.confidence >= confThreshold)
          : basePool;
      const candidatePool = filteredByConf.length > 0 ? filteredByConf : basePool;
      // Ensure selection uses Rank semantics: sort by rank asc and pick by rank property
      const sortedByRank: any[] = [...candidatePool].sort((a, b) => {
        const ar = typeof a?.rank === 'number' ? a.rank : Number.POSITIVE_INFINITY;
        const br = typeof b?.rank === 'number' ? b.rank : Number.POSITIVE_INFINITY;
        return ar - br;
      });

      let choice: any | undefined;
      if (!strat || strat.mode === "rank") {
        const rank = Math.max(1, Math.min(100, strat?.rank ?? (player as any).pickRank ?? 1));
        choice = sortedByRank.find((m) => m?.rank === rank) || sortedByRank[0];
      } else if (strat.mode === "rankSet") {
        const ranks: number[] = (strat.ranks || []).filter((r: number) => r >= 1 && r <= 100);
        const available = ranks
          .map((r) => sortedByRank.find((m) => m?.rank === r))
          .filter((m) => m != null);
        choice = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]
          : sortedByRank[0];
      } else if (strat.mode === "randomTopN") {
        const topN = Math.max(1, Math.min(100, strat.topN));
        const pool = sortedByRank.slice(0, topN);
        choice = pool[Math.floor(Math.random() * pool.length)] || sortedByRank[0];
      }

      const san = choice?.san || choice?.move;
      const firstUci = choice?.pv?.[0];
      if (!san && !firstUci) return;

      // Thinking delay
      const minMs: number = Math.max(0, Number((player as any).thinkingDelayMinMs ?? 200));
      const maxMs: number = Math.max(minMs, Number((player as any).thinkingDelayMaxMs ?? 1200));
      const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      const makeBotMove = () => {
        const [p] = positionFromFen(lastNode.fen);
        if (!p) return;
        const uciMove = firstUci ? parseUci(firstUci) : null;
        const sanMove = !uciMove && san ? parseSan(p, san) : null;
        const finalMove = (uciMove || sanMove) as any;
        if (!finalMove) return;
        appendMove({ payload: finalMove });
        if (firstUci) setLastMove(firstUci);
        botTimeoutRef.current = null;
      };
      if (delay > 0) {
        if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
        botTimeoutRef.current = window.setTimeout(makeBotMove, delay);
      } else {
        makeBotMove();
      }
      return;
    }

    // Existing engine path
    if (player.type === "engine" && player.engine) {
      commands.getBestMoves(
        currentTurn,
        player.engine.path,
        activeTab + currentTurn,
        player.go,
        {
          fen: root.fen,
          moves: moves,
          extraOptions: (player.engine.settings || [])
            .filter((s) => s.name !== "MultiPV")
            .map((s) => ({
              ...s,
              value: s.value?.toString() ?? "",
            })),
          useCache: false,
        },
      );
    }
  }, [pos, gameState, enginePaused, headers.result, players, unifiedLoadable, lastNode.fen, root.fen, moves, activeTab]);

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

  // Removed same time control option entirely
  const [enableAnalysisOnStart, setEnableAnalysisOnStart] = useState(autoStartAnalysis);

  // Update local state when global setting changes
  useEffect(() => {
    setEnableAnalysisOnStart(autoStartAnalysis);
  }, [autoStartAnalysis]);

  // Auto-start with default Human vs Human, unlimited time on new or play tabs
  useEffect(() => {
    if (gameState !== "settingUp") return;
    if (currentTab?.type === "new") {
      startGame();
      // Flip tab type to play so subsequent logic treats it as a playing tab
      setTabs((prev) =>
        prev.map((tab) =>
          tab.value === activeTab ? { ...tab, type: "play" } : tab,
        ),
      );
    } else if (currentTab?.type === "play") {
      startGame();
    }
  }, [currentTab?.type, gameState, setTabs, activeTab]);

  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  // Track captured pieces per side from Board
  const [captured, setCaptured] = useState<{ white: PiecesCount; black: PiecesCount}>({
    white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  });
  const [materialDiff, setMaterialDiff] = useState(0);

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

  // Removed game-over by timeout checks; clocks now count up

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

    const players = getPlayers();

    // Initialize clocks to 0 (count-up)
    setWhiteTime(0);
    setBlackTime(0);

    setPlayers(players);

    const newHeaders: Partial<GameHeaders> = {
      white: players.white.type === "human" ? "Player" : players.white.engine?.name ?? "?",
      black: players.black.type === "human" ? "Player" : players.black.engine?.name ?? "?",
      time_control: undefined,
    };

    // Remove time control headers; unlimited by default

    setHeaders({
      ...headers,
      ...newHeaders,
      fen: root.fen,
    });

    setTabs((prev) =>
      prev.map((tab) => {
        const whiteName =
          players.white.type === "human"
            ? players.white.name
            : (players.white.engine?.name ?? "?");

        const blackName =
          players.black.type === "human"
            ? players.black.name
            : (players.black.engine?.name ?? "?");

        return tab.value === activeTab
          ? {
              ...tab,
              name: `${whiteName} vs. ${blackName}`,
            }
          : tab;
      }),
    );

    // Auto-start analysis engines if setting is enabled
    if (enableAnalysisOnStart) {
      enableAnalysisEngines(true);
    }
  }

  useEffect(() => {
    if (gameState === "playing" && !enginePaused && !intervalId) {
      const intervalId = setInterval(decrementTime, 100);
      setIntervalId(intervalId);
    }
  }, [gameState, enginePaused, intervalId, pos?.turn]);

  const onePlayerIsEngine =
    (players.white.type === "engine" || players.black.type === "engine") &&
    players.white.type !== players.black.type;

  const [boardLayoutState, setBoardLayoutState] = useAtom(boardLayoutStateAtom);

  // NEW: nested mosaic state for playing
  const [playingLayoutState, setPlayingLayoutState] = useAtom(playingLayoutAtom);

  // Define the board/sidebar layout
  const boardLayout: { [viewId in BoardViewId]: JSX.Element } = {
    board: (
      <Paper withBorder shadow="sm" p="md" h="100%">
        <Board
          dirty={false}
          editingMode={false}
          toggleEditingMode={() => undefined}
          viewOnly={gameState !== "playing"}
          disableVariations
          boardRef={boardRef}
          canTakeBack={onePlayerIsEngine}
          movable={movable}
          whiteTime={
            gameState === "playing" ? (whiteTime ?? undefined) : undefined
          }
          blackTime={
            gameState === "playing" ? (blackTime ?? undefined) : undefined
          }
          onCapturedChange={setCaptured}
        />
      </Paper>
    ),
    sidebar: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ overflow: "hidden" }}>
        <SimplifiedSidebar 
          headers={headers} 
          onePlayerIsEngine={onePlayerIsEngine} 
          enginePaused={enginePaused} 
          setEnginePaused={setEnginePaused} 
          onNewGame={() => {
            setGameState("settingUp");
            setWhiteTime(null);
            setBlackTime(null);
            setFen(INITIAL_FEN);
            setHeaders({
              ...headers,
              result: "*",
            });
          }} 
        />
      </Paper>
    ),
  };

  // NEW: Define nested mosaic tile renderers for playing view
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
      />
    ),
    centerBoard: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Box style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box style={{ height: "100%", maxWidth: "100%", aspectRatio: "1 / 1", display: "flex" }}>
            <Board
              dirty={false}
              editingMode={false}
              toggleEditingMode={() => undefined}
              viewOnly={gameState !== "playing"}
              disableVariations
              boardRef={boardRef}
              canTakeBack={onePlayerIsEngine}
              movable={movable}
              whiteTime={gameState === "playing" ? (whiteTime ?? undefined) : undefined}
              blackTime={gameState === "playing" ? (blackTime ?? undefined) : undefined}
              fitContainer
              onCapturedChange={setCaptured}
              onMaterialDiffChange={setMaterialDiff}
            />
          </Box>
        </Box>
        {/* Global controls affecting both players */}
        <Group mt="sm" gap="sm">
          <Button
            onClick={() => setEnginePaused((prev) => !prev)}
            leftSection={enginePaused ? <IconPlayerPlay /> : <IconPlayerStop />}
            variant="default"
          >
            {enginePaused ? "Play" : "Pause"}
          </Button>
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
      />
    ),
    linesTree: (
      <Paper withBorder shadow="sm" p="xs" h="100%" style={{ minHeight: 300, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Box style={{ flex: 1, minHeight: 0 }}>
          <LinesTree />
        </Box>
      </Paper>
    ),
    unifiedMoves: (
      <Paper withBorder shadow="sm" p="xs" h="100%" style={{ minHeight: 300, minWidth: 500, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <UnifiedMovesTable />
        </Box>
      </Paper>
    ),
    // These are placeholders to satisfy the type; not used directly as root children
    top: <Box h="100%" />,
    bottom: <Box h="100%" />,
  };

  return (
    <>
      <EvalListener />
      {/* Resizable layouts */}
      {gameState === "playing" || gameState === "gameOver" ? (
        <Box style={{ height: "100%", padding: "8px", overflow: "hidden" }}>
          <Mosaic<PlayingViewId>
            renderTile={(id) => playingTiles[id]}
            value={playingLayoutState.currentNode}
            onChange={(currentNode) => setPlayingLayoutState({ currentNode })}
            resize={{ minimumPaneSizePercentage: 10 }}
          />
        </Box>
      ) : (
        <Box style={{ height: "100%", padding: "8px", overflow: "hidden" }}>
          <Mosaic<BoardViewId>
            renderTile={(id) => boardLayout[id]}
            value={boardLayoutState.currentNode}
            onChange={(currentNode) => setBoardLayoutState({ currentNode })}
            resize={{ minimumPaneSizePercentage: 20 }}
          />
        </Box>
      )}
    </>
  );
}

export default BoardGame;

// Simplified sidebar with tabs instead of complex Mosaic
function SimplifiedSidebar({
  headers,
  onePlayerIsEngine,
  enginePaused,
  setEnginePaused,
  onNewGame,
}: {
  headers: GameHeaders;
  onePlayerIsEngine: boolean;
  enginePaused: boolean;
  setEnginePaused: (fn: (prev: boolean) => boolean) => void;
  onNewGame: () => void;
}) {
  const [, enable] = useAtom(enableAllAtom);
  const allEnabledLoader = useAtomValue(allEnabledAtom);
  const allEnabled = allEnabledLoader.state === "hasData" && allEnabledLoader.data;

  return (
    <Stack h="100%" gap="xs">
      {/* Control buttons */}
      <Group grow>
        {onePlayerIsEngine && (
          <Button
            onClick={() => setEnginePaused((prev) => !prev)}
            leftSection={enginePaused ? <IconPlayerPlay /> : <IconPlayerStop />}
          >
            {enginePaused ? "Play" : "Stop"}
          </Button>
        )}
        <Button
          variant={allEnabled ? "filled" : "default"}
          onClick={() => enable(!allEnabled)}
        >
          {allEnabled ? "Stop Analysis" : "Start Analysis"}
        </Button>
      </Group>

      {/* Tabbed content */}
      <Tabs defaultValue="analysis" style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Tabs.List>
          {/* <Tabs.Tab value="gameInfo">Game</Tabs.Tab> */}
          <Tabs.Tab value="analysis">Analysis</Tabs.Tab>
          <Tabs.Tab value="moves">Moves</Tabs.Tab>
          <Tabs.Tab value="annotation">Notes</Tabs.Tab>
          <Tabs.Tab value="info">Info</Tabs.Tab>
        </Tabs.List>

        <Box style={{ flexGrow: 1, overflow: "hidden" }}>
          <Tabs.Panel value="analysis" h="100%">
            <Suspense fallback={<Text>Loading analysis...</Text>}>
              <AnalysisPanel />
            </Suspense>
          </Tabs.Panel>

          <Tabs.Panel value="moves" h="100%">
            <Stack h="100%" gap="xs">
              <GameNotation topBar />
              <MoveControls />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="annotation" h="100%">
            <AnnotationPanel />
          </Tabs.Panel>

          <Tabs.Panel value="info" h="100%">
              <GameInfo headers={headers} />
            <InfoPanel />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Stack>
  );
}
