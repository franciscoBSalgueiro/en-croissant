import { events, type GoMode, commands } from "@/bindings";
import {
  activeTabAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  enginesAtom,
  tabsAtom,
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
  Portal,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArrowsExchange,
  IconPlus,
  IconZoomCheck,
} from "@tabler/icons-react";
import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import {
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import GameInfo from "../common/GameInfo";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import TimeInput from "../common/TimeInput";
import { TreeStateContext } from "../common/TreeStateContext";
import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
import Board from "./Board";

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

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);

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

  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);
  const [gameState, setGameState] = useAtom(currentGameStateAtom);

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab,
      ),
    );
  }
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
    if (pos && gameState === "playing") {
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
        appendMove({
          payload: parseUci(ev[0].uciMoves[0])!,
          clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined,
        });
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

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
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
      </Portal>
      <Portal target="#topRight" style={{ height: "100%", overflow: "hidden" }}>
        <Paper withBorder shadow="sm" p="md" h="100%">
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
                  label="Same time control"
                  checked={sameTimeControl}
                  onChange={(e) => setSameTimeControl(e.target.checked)}
                />

                <Group>
                  <Button onClick={startGame} disabled={error !== null}>
                    Start game
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
                <Button
                  onClick={() => {
                    setGameState("settingUp");
                    setWhiteTime(null);
                    setBlackTime(null);
                    setFen(INITIAL_FEN);
                    setHeaders({
                      ...headers,
                      result: "*",
                    });
                  }}
                  leftSection={<IconPlus />}
                >
                  New Game
                </Button>
                <Button
                  variant="default"
                  onClick={() => changeToAnalysisMode()}
                  leftSection={<IconZoomCheck />}
                >
                  Analyze
                </Button>
              </Group>
            </Stack>
          )}
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        <Stack h="100%" gap="xs">
          <GameNotation topBar />
          <MoveControls />
        </Stack>
      </Portal>
    </>
  );
}

export default BoardGame;
