import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Portal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconArrowsExchange,
  IconFileText,
  IconPlus,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import type { Piece } from "chessops";
import { makeUci, parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import { useAtom, useAtomValue } from "jotai";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import type { Outcome } from "@/bindings";
import {
  commands,
  type EngineLog,
  events,
  type GameConfig,
  type GameResult,
  type PlayerConfig,
} from "@/bindings";
import type { ChessgroundRef } from "@/chessground/Chessground";
import {
  activeTabAtom,
  currentGameIdAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  gameInputColorAtom,
  gamePlayer1SettingsAtom,
  gamePlayer2SettingsAtom,
  gameSameTimeControlAtom,
  tabsAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import type { GameHeaders } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import EngineLogsView from "../common/EngineLogsView";
import GameInfo from "../common/GameInfo";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import Board from "./Board";
import BoardControls from "./BoardControls";
import EditingCard from "./EditingCard";
import { OpponentForm, type OpponentSettings } from "./OpponentForm";

function gameResultToOutcome(result: GameResult): Outcome {
  if (result.type === "whiteWins") return "1-0";
  if (result.type === "blackWins") return "0-1";
  return "1/2-1/2";
}

type BackendMove = { uci: string; clock: number | null };

function mapBackendMoves(
  moves: { uci: string; clock: bigint | null }[],
): BackendMove[] {
  return moves.map((m) => ({
    uci: m.uci,
    clock: m.clock !== null ? Number(m.clock) : null,
  }));
}

function BoardGame() {
  const { t } = useTranslation();
  const activeTab = useAtomValue(activeTabAtom);

  const [editingMode, toggleEditingMode] = useToggle();
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  const [inputColor, setInputColor] = useAtom(gameInputColorAtom);
  function cycleColor() {
    setInputColor((prev) =>
      match(prev)
        .with("white", () => "black" as const)
        .with("black", () => "random" as const)
        .with("random", () => "white" as const)
        .exhaustive(),
    );
  }

  const [player1Settings, setPlayer1Settings] = useAtom(
    gamePlayer1SettingsAtom,
  );
  const [player2Settings, setPlayer2Settings] = useAtom(
    gamePlayer2SettingsAtom,
  );

  function getPlayers() {
    let isPlayer1White = inputColor === "white";

    if (inputColor === "random") {
      isPlayer1White = Math.random() > 0.5;
    }

    return {
      white: isPlayer1White ? player1Settings : player2Settings,
      black: isPlayer1White ? player2Settings : player1Settings,
    };
  }

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const setResult = useStore(store, (s) => s.setResult);
  const appendMove = useStore(store, (s) => s.appendMove);

  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);
  const cgRef = useRef<ChessgroundRef>(null);
  const [gameState, setGameState] = useAtom(currentGameStateAtom);
  const [players, setPlayers] = useAtom(currentPlayersAtom);

  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);
  const [gameId, setGameId] = useAtom(currentGameIdAtom);

  const [logsOpened, toggleLogsOpened] = useToggle();
  const [logsColor, setLogsColor] = useState<"white" | "black">("white");
  const [engineLogs, setEngineLogs] = useState<EngineLog[]>([]);

  const hasEngine =
    players.white.type === "engine" || players.black.type === "engine";

  const isPlayerVsEngine =
    (players.white.type === "human" && players.black.type === "engine") ||
    (players.black.type === "human" && players.white.type === "engine");

  const fetchEngineLogs = useCallback(async () => {
    if (!gameId || !hasEngine) return;
    let color = logsColor;
    if (players.white.type === "human" && players.black.type === "engine") {
      color = "black";
    } else if (
      players.black.type === "human" &&
      players.white.type === "engine"
    ) {
      color = "white";
    }
    const result = await commands.getGameEngineLogs(gameId, color);
    if (result.status === "ok") {
      setEngineLogs(result.data);
    }
  }, [gameId, logsColor, hasEngine, players.white.type, players.black.type]);

  useEffect(() => {
    if (logsOpened) {
      fetchEngineLogs();
    }
  }, [logsOpened, fetchEngineLogs]);

  const syncTreeWithMoves = useCallback(
    (backendMoves: BackendMove[]) => {
      const treeMoves: string[] = [];
      let node = root;
      while (node.children.length > 0) {
        node = node.children[0];
        if (node.move) {
          treeMoves.push(makeUci(node.move));
        }
      }

      let needsReset = false;
      for (let i = 0; i < treeMoves.length; i++) {
        if (i >= backendMoves.length || treeMoves[i] !== backendMoves[i].uci) {
          needsReset = true;
          break;
        }
      }

      if (needsReset) {
        setFen(root.fen);
        for (const move of backendMoves) {
          const parsed = parseUci(move.uci);
          if (parsed) {
            appendMove({
              payload: parsed,
              clock: move.clock !== null ? Number(move.clock) : undefined,
            });
          }
        }
        return true;
      }

      if (backendMoves.length > treeMoves.length) {
        for (let i = treeMoves.length; i < backendMoves.length; i++) {
          const move = backendMoves[i];
          const parsed = parseUci(move.uci);
          if (parsed) {
            appendMove({
              payload: parsed,
              clock: move.clock !== null ? Number(move.clock) : undefined,
            });
          }
        }
        return true;
      }

      return false;
    },
    [root, setFen, appendMove],
  );

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab,
      ),
    );
  }

  const [pos, error] = useMemo(() => {
    let node = root;
    while (node.children.length > 0) {
      node = node.children[0];
    }
    return positionFromFen(node.fen);
  }, [root]);

  function toPlayerConfig(settings: OpponentSettings): PlayerConfig {
    if (settings.type === "human") {
      return {
        type: "human",
        name: settings.name ?? "Player",
      };
    }
    return {
      type: "engine",
      name: settings.engine?.name ?? "Engine",
      path: settings.engine?.path ?? "",
      options: (settings.engine?.settings ?? [])
        .filter((s) => s.name !== "MultiPV")
        .map((s) => ({
          name: s.name,
          value: s.value?.toString() ?? "",
        })),
      go: settings.timeControl ? null : settings.go,
    };
  }

  function getTreeMoves(): string[] {
    const moves: string[] = [];
    let node = root;
    while (node.children.length > 0) {
      node = node.children[0];
      if (node.move) {
        moves.push(makeUci(node.move));
      }
    }
    return moves;
  }

  async function startGame() {
    const playerSettings = getPlayers();
    setPlayers(playerSettings);

    const newGameId = `${activeTab}-game`;
    setGameId(newGameId);

    const initialMoves = getTreeMoves();

    const config: GameConfig = {
      white: toPlayerConfig(playerSettings.white),
      black: toPlayerConfig(playerSettings.black),
      whiteTimeControl: playerSettings.white.timeControl
        ? {
            initialTime: playerSettings.white.timeControl.seconds,
            increment: playerSettings.white.timeControl.increment ?? 0,
          }
        : null,
      blackTimeControl: playerSettings.black.timeControl
        ? {
            initialTime: playerSettings.black.timeControl.seconds,
            increment: playerSettings.black.timeControl.increment ?? 0,
          }
        : null,
      initialFen: root.fen === INITIAL_FEN ? null : root.fen,
      initialMoves,
    } as GameConfig;

    try {
      const result = await commands.startGame(newGameId, config);
      const state = unwrap(result);

      setWhiteTime(state.whiteTime !== null ? Number(state.whiteTime) : null);
      setBlackTime(state.blackTime !== null ? Number(state.blackTime) : null);

      setGameState("playing");

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ".");
      const timeStr = now.toISOString().slice(11, 19);

      const whiteIsEngine = playerSettings.white.type === "engine";
      const blackIsEngine = playerSettings.black.type === "engine";
      let eventStr = "Casual Game";
      if (whiteIsEngine && blackIsEngine) {
        eventStr = "Engine Match";
      } else if (whiteIsEngine || blackIsEngine) {
        eventStr = "Player vs Engine";
      } else {
        eventStr = "Player Match";
      }

      const formatTimeControl = (settings: OpponentSettings): string => {
        if (!settings.timeControl) return "-";
        const seconds = settings.timeControl.seconds / 1000;
        const increment = (settings.timeControl.increment ?? 0) / 1000;
        return increment ? `${seconds}+${increment}` : `${seconds}`;
      };

      const whiteTimeControl = formatTimeControl(playerSettings.white);
      const blackTimeControl = formatTimeControl(playerSettings.black);
      const sameTimeControl = whiteTimeControl === blackTimeControl;

      const newHeaders: Partial<GameHeaders> = {
        white: state.whitePlayer,
        black: state.blackPlayer,
        event: eventStr,
        site: "En Croissant",
        date: dateStr,
        time: timeStr,
        time_control: undefined,
      };

      if (sameTimeControl) {
        if (whiteTimeControl !== "-") {
          newHeaders.time_control = whiteTimeControl;
        }
      } else {
        newHeaders.white_time_control = whiteTimeControl;
        newHeaders.black_time_control = blackTimeControl;
      }

      setHeaders({
        ...headers,
        ...newHeaders,
        fen: root.fen,
      });

      setTabs((prev) =>
        prev.map((tab) =>
          tab.value === activeTab
            ? { ...tab, name: `${state.whitePlayer} vs. ${state.blackPlayer}` }
            : tab,
        ),
      );
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }

  const handleHumanMove = useCallback(
    async (uci: string) => {
      if (!gameId || gameState !== "playing") return;

      try {
        const result = await commands.makeGameMove(gameId, uci);
      } catch (err) {
        console.error("Failed to make move:", err);
      }
    },
    [gameId, gameState],
  );

  const pendingMovesRef = useRef<
    { uci: string; clock: number | null }[] | null
  >(null);
  const pendingTimesRef = useRef<{
    white: number | null;
    black: number | null;
  } | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THROTTLE_MS = 150;

  const syncTreeWithMovesRef = useRef(syncTreeWithMoves);
  syncTreeWithMovesRef.current = syncTreeWithMoves;

  const applyPendingUpdates = useCallback(() => {
    if (pendingMovesRef.current) {
      syncTreeWithMovesRef.current(pendingMovesRef.current);
      pendingMovesRef.current = null;
    }
    if (pendingTimesRef.current) {
      setWhiteTime(pendingTimesRef.current.white);
      setBlackTime(pendingTimesRef.current.black);
      pendingTimesRef.current = null;
    }
    throttleTimerRef.current = null;

    setTimeout(() => {
      cgRef.current?.playPremove();
    }, 0);
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(applyPendingUpdates, THROTTLE_MS);
    }
  }, [applyPendingUpdates]);

  const onTakeBack = useCallback(async () => {
    if (!gameId || gameState !== "playing") return;
    const result = await commands.takeBackGameMove(gameId);
  }, [gameId, gameState]);

  useEffect(() => {
    if (gameState !== "playing" || !gameId) return;

    const currentGameId = gameId;

    const unlistenMove = events.gameMoveEvent.listen(({ payload }) => {
      if (payload.gameId !== currentGameId) return;

      pendingMovesRef.current = mapBackendMoves(payload.moves);
      pendingTimesRef.current = {
        white: payload.whiteTime !== null ? Number(payload.whiteTime) : null,
        black: payload.blackTime !== null ? Number(payload.blackTime) : null,
      };
      scheduleUpdate();
    });

    const unlistenClock = events.clockUpdateEvent.listen(({ payload }) => {
      if (payload.gameId !== currentGameId) return;
      setWhiteTime(
        payload.whiteTime !== null ? Number(payload.whiteTime) : null,
      );
      setBlackTime(
        payload.blackTime !== null ? Number(payload.blackTime) : null,
      );
    });

    const unlistenGameOver = events.gameOverEvent.listen(({ payload }) => {
      if (payload.gameId !== currentGameId) return;

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingMovesRef.current = null;
      pendingTimesRef.current = null;

      syncTreeWithMovesRef.current(mapBackendMoves(payload.moves));

      setGameState("gameOver");
      setResult(gameResultToOutcome(payload.result));
    });

    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      unlistenMove.then((f) => f());
      unlistenClock.then((f) => f());
      unlistenGameOver.then((f) => f());
    };
  }, [gameId, gameState, scheduleUpdate, setGameState, setResult]);

  useEffect(() => {
    if (gameState === "playing" && gameId) {
      commands.getGameState(gameId).then((result) => {
        if (result.status === "ok") {
          const state = result.data;

          syncTreeWithMovesRef.current(mapBackendMoves(state.moves));

          setWhiteTime(
            state.whiteTime !== null ? Number(state.whiteTime) : null,
          );
          setBlackTime(
            state.blackTime !== null ? Number(state.blackTime) : null,
          );

          if (state.status !== "playing") {
            setGameState("gameOver");
            if (
              typeof state.status === "object" &&
              "finished" in state.status
            ) {
              setResult(gameResultToOutcome(state.status.finished.result));
            }
          }
        }
      });
    }
  }, [gameId, gameState, setGameState, setResult]);

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

  const [sameTimeControl, setSameTimeControl] = useAtom(
    gameSameTimeControlAtom,
  );

  const onePlayerIsEngine = players.white.type !== players.black.type;
  const isEngineVsEngine =
    players.white.type === "engine" && players.black.type === "engine";

  function getResignationLosingColor(): "white" | "black" {
    if (isPlayerVsEngine) {
      return players.white.type === "human" ? "white" : "black";
    }
    return pos?.turn === "white" ? "white" : "black";
  }

  async function handleAbort() {
    if (!gameId) return;
    await commands.abortGame(gameId);
    setGameState("gameOver");
    setResult("*");
  }

  async function handleResign() {
    if (!gameId) return;
    const losingColor = getResignationLosingColor();
    await commands.resignGame(gameId, losingColor);
  }

  async function handleNewGame() {
    setGameId(null);
    setGameState("settingUp");
    setWhiteTime(null);
    setBlackTime(null);
    setFen(INITIAL_FEN);
    setHeaders({
      ...headers,
      result: "*",
    });
  }

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          editingMode={gameState === "settingUp" && editingMode}
          viewOnly={gameState !== "playing" && !editingMode}
          disableVariations
          boardRef={boardRef}
          movable={gameState === "settingUp" && editingMode ? "none" : movable}
          whiteTime={
            gameState === "playing" ? (whiteTime ?? undefined) : undefined
          }
          blackTime={
            gameState === "playing" ? (blackTime ?? undefined) : undefined
          }
          onMove={handleHumanMove}
          selectedPiece={selectedPiece}
          cgRef={cgRef}
          enablePremoves={isPlayerVsEngine && gameState === "playing"}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%", overflow: "hidden" }}>
        <Paper withBorder shadow="sm" p="md" h="100%">
          {logsOpened ? (
            <EngineLogsView
              logs={engineLogs}
              onRefresh={fetchEngineLogs}
              additionalControls={
                <>
                  {players.white.type === "engine" &&
                  players.black.type === "engine" ? (
                    <SegmentedControl
                      value={logsColor}
                      onChange={(value) =>
                        setLogsColor(value as "white" | "black")
                      }
                      data={[
                        { value: "white", label: "White" },
                        { value: "black", label: "Black" },
                      ]}
                    />
                  ) : (
                    <div />
                  )}
                  <ActionIcon flex={0} onClick={() => toggleLogsOpened()}>
                    <IconX size="1.2rem" />
                  </ActionIcon>
                </>
              }
            />
          ) : (
            <>
              {gameState === "settingUp" && (
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
                      label={t("Board.Opponent.SameTimeControl")}
                      checked={sameTimeControl}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSameTimeControl(checked);
                        if (checked) {
                          setPlayer2Settings((prev) => ({
                            ...prev,
                            timeControl: player1Settings.timeControl,
                            timeUnit: player1Settings.timeUnit,
                            incrementUnit: player1Settings.incrementUnit,
                          }));
                        }
                      }}
                    />

                    <Group>
                      <Button
                        onClick={startGame}
                        fullWidth
                        variant="light"
                        disabled={error !== null}
                      >
                        {t("Board.Opponent.StartGame")}
                      </Button>
                    </Group>
                  </Stack>
                </ScrollArea>
              )}
              {(gameState === "playing" || gameState === "gameOver") && (
                <Stack h="100%">
                  <Box flex={1}>
                    <GameInfo headers={headers} />
                  </Box>
                  <Group grow>
                    {gameState === "playing" && (
                      <Button
                        variant="default"
                        color="red"
                        onClick={isEngineVsEngine ? handleAbort : handleResign}
                        leftSection={<IconX />}
                      >
                        {isEngineVsEngine ? "Abort" : "Resign"}
                      </Button>
                    )}
                    {gameState === "gameOver" && (
                      <Button
                        variant="default"
                        onClick={handleNewGame}
                        leftSection={<IconPlus />}
                      >
                        New Game
                      </Button>
                    )}
                    <Button
                      variant="default"
                      onClick={() => changeToAnalysisMode()}
                      leftSection={<IconZoomCheck />}
                    >
                      Analyze
                    </Button>

                    {hasEngine && (
                      <Button
                        variant="default"
                        onClick={() => toggleLogsOpened()}
                        leftSection={<IconFileText size="1rem" />}
                      >
                        Engine Logs
                      </Button>
                    )}
                  </Group>
                </Stack>
              )}
            </>
          )}
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {gameState === "settingUp" && editingMode ? (
          <EditingCard
            boardRef={boardRef}
            setEditingMode={toggleEditingMode}
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
          />
        ) : (
          <Stack h="100%" gap="xs">
            <GameNotation
              topBar
              controls={
                <BoardControls
                  editingMode={gameState === "settingUp" && editingMode}
                  toggleEditingMode={toggleEditingMode}
                  dirty={false}
                  canTakeBack={onePlayerIsEngine}
                  onTakeBack={onTakeBack}
                  disableVariations
                  allowEditing={gameState === "settingUp"}
                />
              }
            />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardGame;
