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
import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
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
      engine: LocalEngine | null;
      go: GoMode;
    };

function OpponentForm({
  sameTimeControl,
  opponent,
  setOpponent,
  setOtherOpponent,
}: {
  sameTimeControl: boolean;
  opponent: OpponentSettings;
  setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
  setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
}) {
  function updateType(type: "engine" | "human") {
    if (type === "human") {
      setOpponent((prev) => ({
        ...prev,
        type: "human",
        name: "Player",
      }));
    } else {
      setOpponent((prev) => ({
        ...prev,
        type: "engine",
        engine: null,
        go: {
          t: "Depth",
          c: 24,
        },
      }));
    }
  }

  return (
    <Stack flex={1}>
      <SegmentedControl
        data={[
          { value: "human", label: "Human" },
          { value: "engine", label: "Engine" },
        ]}
        value={opponent.type}
        onChange={(v) => updateType(v as "human" | "engine")}
      />

      {opponent.type === "human" && (
        <TextInput
          label="Name"
          value={opponent.name ?? ""}
          onChange={(e) =>
            setOpponent((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      )}

      {opponent.type === "engine" && (
        <EnginesSelect
          engine={opponent.engine}
          setEngine={(engine) => setOpponent((prev) => ({ ...prev, engine }))}
        />
      )}

      <Divider variant="dashed" label="Time Settings" />
      <SegmentedControl
        data={["Time", "Unlimited"]}
        value={opponent.timeControl ? "Time" : "Unlimited"}
        onChange={(v) => {
          setOpponent((prev) => ({
            ...prev,
            timeControl: v === "Time" ? DEFAULT_TIME_CONTROL : undefined,
          }));
          if (sameTimeControl) {
            setOtherOpponent((prev) => ({
              ...prev,
              timeControl: v === "Time" ? DEFAULT_TIME_CONTROL : undefined,
            }));
          }
        }}
      />
      <Group grow wrap="nowrap">
        {opponent.timeControl && (
          <>
            <InputWrapper label="Time">
              <TimeInput
                defaultType="m"
                value={opponent.timeControl.seconds}
                setValue={(v) => {
                  setOpponent((prev) => ({
                    ...prev,
                    timeControl: {
                      seconds: v.t === "Time" ? v.c : 0,
                      increment: prev.timeControl?.increment ?? 0,
                    },
                  }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({
                      ...prev,
                      timeControl: {
                        seconds: v.t === "Time" ? v.c : 0,
                        increment: prev.timeControl?.increment ?? 0,
                      },
                    }));
                  }
                }}
              />
            </InputWrapper>
            <InputWrapper label="Increment">
              <TimeInput
                defaultType="s"
                value={opponent.timeControl.increment ?? 0}
                setValue={(v) => {
                  setOpponent((prev) => ({
                    ...prev,
                    timeControl: {
                      seconds: prev.timeControl?.seconds ?? 0,
                      increment: v.t === "Time" ? v.c : 0,
                    },
                  }));
                  if (sameTimeControl) {
                    setOtherOpponent((prev) => ({
                      ...prev,
                      timeControl: {
                        seconds: prev.timeControl?.seconds ?? 0,
                        increment: v.t === "Time" ? v.c : 0,
                      },
                    }));
                  }
                }}
              />
            </InputWrapper>
          </>
        )}
      </Group>

      {opponent.type === "engine" && (
        <Stack>
          {opponent.engine && !opponent.timeControl && (
            <EngineSettingsForm
              engine={opponent.engine}
              remote={false}
              gameMode
              settings={{
                go: opponent.go,
                settings: opponent.engine.settings || [],
                enabled: true,
                synced: false,
                allMoves: false,
                useCache: false,
              }}
              setSettings={(fn) =>
                setOpponent((prev) => {
                  if (prev.type === "human") {
                    return prev;
                  }
                  const newSettings = fn({
                    go: prev.go,
                    settings: prev.engine?.settings || [],
                    enabled: true,
                    synced: false,
                    allMoves: false,
                    useCache: false,
                  });
                  return { ...prev, ...newSettings };
                })
              }
              minimal={true}
            />
          )}
        </Stack>
      )}
    </Stack>
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
    second: {
      direction: "row",
      first: "linesTree",
      second: "unifiedMoves",
      splitPercentage: 58,
    },
    splitPercentage: 76,
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
    timeControl: DEFAULT_TIME_CONTROL,
  });
  const [player2Settings, setPlayer2Settings] = useState<OpponentSettings>({
    type: "human",
    name: "Player",
    timeControl: DEFAULT_TIME_CONTROL,
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

  useEffect(() => {
    if (pos?.isEnd()) {
      setGameState("gameOver");
    }
  }, [pos, setGameState]);

  const [players, setPlayers] = useAtom(currentPlayersAtom);

  useEffect(() => {
    if (pos && gameState === "playing" && !enginePaused) {
      if (headers.result !== "*") {
        setGameState("gameOver");
        return;
      }
      const currentTurn = pos.turn;
      const player = currentTurn === "white" ? players.white : players.black;

      if (player.type === "engine" && player.engine) {
        commands.getBestMoves(
          currentTurn,
          player.engine.path,
          activeTab + currentTurn,
          player.timeControl
            ? {
                t: "PlayersTime",
                c: {
                  white: whiteTime ?? 0,
                  black: blackTime ?? 0,
                  winc: player.timeControl.increment ?? 0,
                  binc: player.timeControl.increment ?? 0,
                },
              }
            : player.go,
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
    }
  }, [
    gameState,
    pos,
    players,
    headers.result,
    setGameState,
    activeTab,
    root.fen,
    moves,
    enginePaused,
  ]);

  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);

  useEffect(() => {
    const unlisten = events.bestMovesPayload.listen(({ payload }) => {
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
  }, [activeTab, appendMove, pos, root.fen, moves, whiteTime, blackTime]);

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

  const [sameTimeControl, setSameTimeControl] = useState(true);
  const [enableAnalysisOnStart, setEnableAnalysisOnStart] = useState(autoStartAnalysis);

  // Update local state when global setting changes
  useEffect(() => {
    setEnableAnalysisOnStart(autoStartAnalysis);
  }, [autoStartAnalysis]);

  const [intervalId, setIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  useEffect(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [pos?.turn]);

  useEffect(() => {
    if (gameState === "playing" && whiteTime !== null && whiteTime <= 0) {
      setGameState("gameOver");
      setResult("0-1");
    }
  }, [gameState, whiteTime, setGameState, setResult]);

  useEffect(() => {
    if (gameState !== "playing") {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [gameState, intervalId]);

  useEffect(() => {
    if (gameState === "playing" && blackTime !== null && blackTime <= 0) {
      setGameState("gameOver");
      setResult("1-0");
    }
  }, [gameState, blackTime, setGameState, setResult]);

  function decrementTime() {
    if (gameState === "playing") {
      if (pos?.turn === "white" && whiteTime !== null) {
        setWhiteTime((prev) => prev! - 100);
      } else if (pos?.turn === "black" && blackTime !== null) {
        setBlackTime((prev) => prev! - 100);
      }
    }
  }

  function startGame() {
    setGameState("playing");

    const players = getPlayers();

    if (players.white.timeControl) {
      setWhiteTime(players.white.timeControl.seconds);
    }

    if (players.black.timeControl) {
      setBlackTime(players.black.timeControl.seconds);
    }

    setPlayers(players);

    const newHeaders: Partial<GameHeaders> = {
      white:
        (players.white.type === "human"
          ? players.white.name
          : players.white.engine?.name) ?? "?",
      black:
        (players.black.type === "human"
          ? players.black.name
          : players.black.engine?.name) ?? "?",
      time_control: undefined,
    };

    if (players.white.timeControl || players.black.timeControl) {
      if (sameTimeControl && players.white.timeControl) {
        newHeaders.time_control = `${players.white.timeControl.seconds / 1000}`;
        if (players.white.timeControl.increment) {
          newHeaders.time_control += `+${
            players.white.timeControl.increment / 1000
          }`;
        }
      } else {
        if (players.white.timeControl) {
          newHeaders.white_time_control = `${players.white.timeControl.seconds / 1000}`;
          if (players.white.timeControl.increment) {
            newHeaders.white_time_control += `+${
              players.white.timeControl.increment / 1000
            }`;
          }
        }
        if (players.black.timeControl) {
          newHeaders.black_time_control = `${players.black.timeControl.seconds / 1000}`;
          if (players.black.timeControl.increment) {
            newHeaders.black_time_control += `+${
              players.black.timeControl.increment / 1000
            }`;
          }
        }
      }
    }

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
    if (gameState === "playing" && !intervalId) {
      const intervalId = setInterval(decrementTime, 100);
      if (pos?.turn === "black" && whiteTime !== null) {
        setWhiteTime(
          (prev) => prev! + (players.white.timeControl?.increment ?? 0),
        );
      }
      if (pos?.turn === "white" && blackTime !== null) {
        setBlackTime((prev) => {
          if (pos?.fullmoves === 1) {
            return prev!;
          }

          return prev! + (players.black.timeControl?.increment ?? 0);
        });
      }
      setIntervalId(intervalId);
    }
  }, [gameState, intervalId, pos?.turn]);

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
        />
      </Paper>
    ),
    sidebar: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ overflow: "hidden" }}>
        {gameState === "settingUp" && !isAnalysisTab && (
          <ScrollArea h="100%" offsetScrollbars>
            <Stack>
              <Group>
                <Text flex={1} ta="center" fz="lg" fw="bold">
                  {match(inputColor)
                    .with("white", () => "White")
                    .with("random", () => "Random")
                    .with("black", () => "Black")
                    .exhaustive()}
                </Text>
                <ActionIcon onClick={cycleColor}>
                  <IconArrowsExchange />
                </ActionIcon>
                <Text flex={1} ta="center" fz="lg" fw="bold">
                  {match(inputColor)
                    .with("white", () => "Black")
                    .with("random", () => "Random")
                    .with("black", () => "White")
                    .exhaustive()}
                </Text>
              </Group>
              <Box flex={1}>
                <Group style={{ alignItems: "start" }}>
                  <OpponentForm
                    sameTimeControl={sameTimeControl}
                    opponent={player1Settings}
                    setOpponent={setPlayer1Settings}
                    setOtherOpponent={setPlayer2Settings}
                  />
                  <Divider orientation="vertical" />
                  <OpponentForm
                    sameTimeControl={sameTimeControl}
                    opponent={player2Settings}
                    setOpponent={setPlayer2Settings}
                    setOtherOpponent={setPlayer1Settings}
                  />
                </Group>
              </Box>

              <Checkbox
                label="Same time control"
                checked={sameTimeControl}
                onChange={(e) => setSameTimeControl(e.target.checked)}
              />

              <Checkbox
                label="Enable analysis engines on start"
                checked={enableAnalysisOnStart}
                onChange={(e) => setEnableAnalysisOnStart(e.target.checked)}
              />

              <Group>
                <Button onClick={startGame} disabled={error !== null}>
                  Start game
                </Button>
              </Group>
            </Stack>
          </ScrollArea>
        )}
        {(gameState === "playing" || gameState === "gameOver" || isAnalysisTab) && (
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
        )}
      </Paper>
    ),
  };

  // NEW: Define nested mosaic tile renderers for playing view
  const playingTiles: { [viewId in PlayingViewId]: JSX.Element } = {
    leftPlayer: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ minHeight: 300, overflow: "hidden" }}>
        <Stack gap="xs">
          <Text size="sm" fw={600}>White</Text>
          <Text fw={500}>{headers.white || "White"}</Text>
          <Clock
            color="white"
            turn={pos?.turn || "white"}
            whiteTime={whiteTime ?? undefined}
            blackTime={blackTime ?? undefined}
          />
        </Stack>
      </Paper>
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
            />
          </Box>
        </Box>
      </Paper>
    ),
    rightPlayer: (
      <Paper withBorder shadow="sm" p="md" h="100%" style={{ minHeight: 300, overflow: "hidden" }}>
        <Stack gap="xs">
          <Text size="sm" fw={600}>Black</Text>
          <Text fw={500}>{headers.black || "Black"}</Text>
          <Clock
            color="black"
            turn={pos?.turn || "white"}
            whiteTime={whiteTime ?? undefined}
            blackTime={blackTime ?? undefined}
          />
        </Stack>
      </Paper>
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
