import {
  ActionIcon,
  Box,
  Button,
  Center,
  Divider,
  Group,
  NumberInput,
  Paper,
  Portal,
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
import { Chess, DEFAULT_POSITION } from "chess.js";
import {
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getNodeAtPath, treeIteratorMainLine } from "@/utils/treeReducer";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";
import { activeTabAtom, enginesAtom, tabsAtom } from "@/atoms/atoms";
import { useAtom, useAtomValue } from "jotai";
import { match } from "ts-pattern";
import { parseUci } from "@/utils/chess";
import { invoke } from "@tauri-apps/api";
import { Engine } from "@/utils/engines";

function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: Engine | null;
  setEngine: (engine: Engine | null) => void;
}) {
  const engines = useAtomValue(enginesAtom);

  useEffect(() => {
    if (engines.length > 0 && engine === null) {
      setEngine(engines[0]);
    }
  }, [engine, engines, setEngine]);

  return (
    <Suspense>
      <Select
        label="Engine"
        data={engines!.map((engine) => ({
          label: engine.name,
          value: engine.path,
        }))}
        value={engine?.path ?? ""}
        onChange={(e) => {
          setEngine(engines.find((engine) => engine.path === e)!);
        }}
      />
    </Suspense>
  );
}

export type OpponentSettings =
  | {
      type: "human";
      name?: string;
    }
  | {
      type: "engine";
      engine: Engine | null;
      skillLevel: number | null;
      depth: number;
    };

const enginePresets = [
  {
    id: "easy",
    name: "Easy Bot",
    settings: {
      skillLevel: 2,
      depth: 12,
    },
  },
  {
    id: "medium",
    name: "Medium Bot",
    settings: {
      skillLevel: 4,
      depth: 16,
    },
  },
  {
    id: "hard",
    name: "Hard Bot",
    settings: {
      skillLevel: 6,
      depth: 20,
    },
  },
  {
    id: "impossible",
    name: "Impossible Bot",
    settings: {
      skillLevel: 8,
      depth: 24,
    },
  },
];

function OpponentForm({
  settings,
  setSettings,
}: {
  settings: OpponentSettings;
  setSettings: React.Dispatch<React.SetStateAction<OpponentSettings>>;
}) {
  function updateType(type: "engine" | "human") {
    if (type === "human") {
      setSettings({ type: "human", name: "Player" });
    } else {
      setSettings({
        type: "engine",
        engine: null,
        skillLevel: 2,
        depth: 12,
      });
    }
  }

  return (
    <Stack sx={{ flex: 1 }}>
      <SegmentedControl
        data={[
          { value: "human", label: "Human" },
          { value: "engine", label: "Engine" },
        ]}
        value={settings.type}
        onChange={updateType}
      />

      {settings.type === "human" && (
        <TextInput
          label="Name"
          value={settings.name ?? ""}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      )}

      {settings.type === "engine" && (
        <>
          <EnginesSelect
            engine={settings.engine}
            setEngine={(engine) => setSettings((prev) => ({ ...prev, engine }))}
          />

          <Group grow>
            <NumberInput
              label="Skill Level"
              value={settings.skillLevel ?? 0}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, skillLevel: e || null }))
              }
            />

            <NumberInput
              label="Depth"
              value={settings.depth ?? 0}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, depth: e || 20 }))
              }
            />
          </Group>
        </>
      )}
    </Stack>
  );
}

type GameState = "settingUp" | "playing" | "gameOver";

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);

  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white"
  );
  function cycleColor() {
    setInputColor((prev) =>
      match(prev)
        .with("white", () => "black" as const)
        .with("black", () => "random" as const)
        .with("random", () => "white" as const)
        .exhaustive()
    );
  }

  const [player1Settings, setPlayer1Settings] = useState<OpponentSettings>({
    type: "human",
    name: "Player",
  });
  const [player2Settings, setPlayer2Settings] = useState<OpponentSettings>({
    type: "human",
    name: "Player",
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

  const { headers, root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);
  const [gameState, setGameState] = useState<GameState>("settingUp");

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab
      )
    );
  }
  const mainLine = Array.from(treeIteratorMainLine(root));
  const currentNode = getNodeAtPath(root, position);
  const lastNode = mainLine[mainLine.length - 1].node;

  const chess = useMemo(() => new Chess(lastNode.fen), [lastNode.fen]);

  useEffect(() => {
    if (chess.isGameOver()) {
      setGameState("gameOver");
    }
  }, [lastNode.fen]);

  const [players, setPlayers] = useState<{
    white: OpponentSettings;
    black: OpponentSettings;
  }>(getPlayers);

  useEffect(() => {
    if (gameState === "playing") {
      const currentTurn = chess.turn();
      const player = currentTurn === "w" ? players.white : players.black;

      if (player.type === "engine") {
        invoke<string>("get_single_best_move", {
          skillLevel: player.skillLevel,
          depth: player.depth,
          engine: player.engine?.path,
          fen: lastNode.fen,
        }).then((move) => {
          dispatch({
            type: "APPEND_MOVE",
            payload: parseUci(move),
          });
        });
      }
    }
  }, [position, gameState, chess, players, lastNode.fen, dispatch]);

  const movable = useMemo(() => {
    if (players.white.type === "human" && players.black.type === "human") {
      return "turn";
    } else if (players.white.type === "human") {
      return "white";
    } else if (players.black.type === "human") {
      return "black";
    } else {
      return "none";
    }
  }, [players]);

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
        <BoardPlay
          dirty={false}
          currentNode={currentNode}
          arrows={[]}
          headers={headers}
          editingMode={false}
          toggleEditingMode={() => undefined}
          viewOnly={gameState !== "playing"}
          disableVariations
          boardRef={boardRef}
          movable={movable}
          root={root}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper withBorder shadow="sm" p="md" h="100%">
          {gameState === "settingUp" && (
            <Stack h="100%">
              <Group>
                <Text sx={{ flex: 1 }} ta="center" fz="lg" fw="bold">
                  {match(inputColor)
                    .with("white", () => "White")
                    .with("random", () => "Random")
                    .with("black", () => "Black")
                    .exhaustive()}
                </Text>
                <ActionIcon onClick={cycleColor}>
                  <IconArrowsExchange />
                </ActionIcon>
                <Text sx={{ flex: 1 }} ta="center" fz="lg" fw="bold">
                  {match(inputColor)
                    .with("white", () => "Black")
                    .with("random", () => "Random")
                    .with("black", () => "White")
                    .exhaustive()}
                </Text>
              </Group>
              <Box sx={{ flex: 1 }}>
                <Group sx={{ alignItems: "start" }}>
                  <OpponentForm
                    settings={player1Settings}
                    setSettings={setPlayer1Settings}
                  />
                  <Divider orientation="vertical" />
                  <OpponentForm
                    settings={player2Settings}
                    setSettings={setPlayer2Settings}
                  />
                </Group>
              </Box>

              <Center>
                <Button
                  onClick={() => {
                    setGameState("playing");
                    const players = getPlayers();
                    setPlayers(players);
                    dispatch({
                      type: "SET_HEADERS",
                      payload: {
                        ...headers,
                        white:
                          (players.white.type === "human"
                            ? players.white.name
                            : players.white.engine?.name) ?? "?",
                        black:
                          (players.black.type === "human"
                            ? players.black.name
                            : players.black.engine?.name) ?? "?",
                      },
                    });
                  }}
                >
                  Start game
                </Button>
              </Center>
            </Stack>
          )}
          {(gameState === "playing" || gameState === "gameOver") && (
            <Stack h="100%">
              <Box sx={{ flex: 1 }}>
                <GameInfo headers={headers} />
              </Box>
              <Group grow>
                <Button
                  onClick={() => {
                    setGameState("settingUp");
                    dispatch({
                      type: "SET_FEN",
                      payload: DEFAULT_POSITION,
                    });
                    dispatch({
                      type: "SET_HEADERS",
                      payload: {
                        ...headers,
                        result: "*",
                      },
                    });
                  }}
                  leftIcon={<IconPlus />}
                >
                  New Game
                </Button>
                <Button
                  variant="default"
                  onClick={() => changeToAnalysisMode()}
                  leftIcon={<IconZoomCheck />}
                >
                  Analyze
                </Button>
              </Group>
            </Stack>
          )}
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        <Stack h="100%">
          <GameNotation topBar />
          <MoveControls />
        </Stack>
      </Portal>
    </>
  );
}

export default BoardGame;
