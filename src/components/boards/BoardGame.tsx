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
import { getMainLine } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import { type GameHeaders, treeIteratorMainLine } from "@/utils/treeReducer";
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Collapse,
} from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue, useSetAtom, atom } from "jotai";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { MosaicWithoutDragDropContext as Mosaic, type MosaicNode } from "react-mosaic-component";
import { atomWithStorage } from "jotai/utils";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";
// import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
import Board from "./Board";
import EvalListener from "./EvalListener";
import BotService from "./BotService";
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

const DEFAULT_PLAYING_LAYOUT: MosaicNode<PlayingViewId> = {
  direction: "row",
  first: "leftPlayer",
  second: {
    direction: "row",
    first: "centerBoard",
    second: "rightPlayer",
    splitPercentage: 72,
  },
  splitPercentage: 22,
};

const playingLayoutAtom = atomWithStorage<PlayingLayoutState>("playingLayoutState", {
  currentNode: DEFAULT_PLAYING_LAYOUT,
});

// Persisted toggle for bottom AnalysisBar visibility
const analysisBarOpenAtom = atomWithStorage<boolean>("analysisBarOpen", true);

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const currentTab = useAtomValue(currentTabAtom);
  const isAnalysisTab = currentTab?.type === "analysis";

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
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

  // Unified moves for the previous position (before the last move)
  const prevNode = mainLine.length > 1 ? mainLine[mainLine.length - 2].node : null;
  const unifiedPrevAtom = useMemo(() => {
    const is960 = headers.variant === "Chess960";
    const currentMoves = getMainLine(root, is960).slice(0, -1);
    const base = prevNode
      ? unifiedMovesFamily({ rootFen: root.fen, fen: prevNode.fen, moves: currentMoves, tab: activeTabForBot! })
      : atom<UnifiedMove[]>([]);
    return loadable(base as any);
  }, [prevNode?.fen, headers.variant, root, activeTabForBot]);
  const unifiedPrevLoadable = useAtomValue(unifiedPrevAtom);

  // Ensure any move made via external UI (e.g., UnifiedMovesTable click) is reflected in Played Moves
  useEffect(() => {
    if (gameState !== "playing") return;
    const san = (lastNode as any)?.san as string | undefined;
    const half = (lastNode as any)?.halfMoves as number | undefined;
    if (!san || typeof half !== 'number' || half <= 0) return;
    const color: "white" | "black" = (half % 2 === 1) ? "white" : "black";
    const moveNumber = Math.ceil(half / 2);
    const list = color === "white" ? whitePlayed : blackPlayed;
    const exists = list.some((m: any) => (m.san || m.move) === san && m.moveNumber === moveNumber);
    if (exists) return;
    try {
      const unifiedList: UnifiedMove[] = unifiedPrevLoadable.state === 'hasData' ? (unifiedPrevLoadable.data as UnifiedMove[]) : [];
      const found = unifiedList.find((m) => (m.san || m.move) === san);
      const setter = color === "white" ? setWhitePlayed : setBlackPlayed;
      if (found) {
        setter((prev) => [...prev, { ...found, moveNumber }]);
      } else {
        setter((prev) => [...prev, { move: san, san, rank: (prev.length + 1), source: 'database', moveNumber } as any]);
      }
    } catch {}
  }, [gameState, lastNode?.san, lastNode?.halfMoves, whitePlayed, blackPlayed, unifiedPrevLoadable, setWhitePlayed, setBlackPlayed]);

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
  const [analysisOpen, setAnalysisOpen] = useAtom(analysisBarOpenAtom);

  // Remove deprecated views (linesTree/unifiedMoves) from any persisted layout to avoid empty panes
  const pruneLayout = useMemo(() => {
    const prune = (node: MosaicNode<PlayingViewId> | null): MosaicNode<PlayingViewId> | null => {
      if (!node) return null;
      if (typeof node === "string") {
        return node === "linesTree" || node === "unifiedMoves" ? null : node;
      }
      const first = prune(node.first as any);
      const second = prune(node.second as any);
      if (first && second) return { ...(node as any), first, second };
      if (first) return first;
      if (second) return second;
      return null;
    };
    return prune(playingLayoutState.currentNode) ?? DEFAULT_PLAYING_LAYOUT;
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
      />
    ),
    centerBoard: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Box style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box style={{ height: "100%", maxWidth: "100%", aspectRatio: "1 / 1", display: "flex", minWidth: 0, minHeight: 0 }}>
            <Board
              dirty={false}
              editingMode={false}
              toggleEditingMode={() => undefined}
              viewOnly={false}
              disableVariations
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
      />
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
            onChange={(currentNode) =>
              setPlayingLayoutState({ currentNode: (currentNode as any) ?? DEFAULT_PLAYING_LAYOUT })
            }
            resize={{ minimumPaneSizePercentage: 10 }}
          />
        </Box>

        <Group justify="space-between" mt="xs">
          <Button
            onClick={() => setAnalysisOpen((prev) => !prev)}
            variant="default"
            size="xs"
          >
            {analysisOpen ? "Hide Analysis" : "Show Analysis"}
          </Button>
        </Group>

        <Collapse in={analysisOpen}>
          <Box mt="xs">
            <AnalysisBar height={380} />
          </Box>
        </Collapse>
      </Box>
    </>
  );
}

export default BoardGame;
