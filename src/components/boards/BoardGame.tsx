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
import { useSessionStorage } from "@mantine/hooks";
import {
  IconArrowsExchange,
  IconPlus,
  IconRobot,
  IconZoomCheck,
} from "@tabler/icons-react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { Suspense, useContext, useEffect, useRef, useState } from "react";
import { getNodeAtPath } from "@/utils/treeReducer";
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

function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: string | null;
  setEngine: (engine: string | null) => void;
}) {
  const engines = useAtomValue(enginesAtom);

  useEffect(() => {
    if (engines.length > 0 && engine === null) {
      setEngine(engines[0].path);
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
        value={engine}
        onChange={(e) => {
          setEngine(e);
        }}
      />
    </Suspense>
  );
}

type OpponentSettings =
  | {
      type: "human";
      name?: string;
    }
  | {
      type: "engine";
      engine: string | null;
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

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const [opponent, setOpponent] = useSessionStorage<string | null>({
    key: activeTab + "-opponent",
    defaultValue: null,
  });
  const { headers, root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentNode = getNodeAtPath(root, position);
  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);

  const [playingColor, setPlayingColor] = useState<"white" | "black">("white");

  const chess = new Chess(currentNode.fen);

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab
      )
    );
  }

  // useEffect(() => {
  //   const isBotTurn = match(playingColor)
  //     .with("black", () => chess.turn() === "w")
  //     .with("white", () => chess.turn() === "b")
  //     .exhaustive();
  //   if (
  //     currentNode.children.length === 0 &&
  //     opponent &&
  //     opponent !== "human" &&
  //     isBotTurn &&
  //     !chess.isGameOver()
  //   ) {
  //     if (opponent === "random") {
  //       invoke<string>("make_random_move", {
  //         fen: currentNode.fen,
  //       }).then((move) => {
  //         dispatch({
  //           type: "MAKE_MOVE",
  //           payload: parseUci(move),
  //         });
  //       });
  //     } else if (engine) {
  //       invoke<string>("get_single_best_move", {
  //         skillLevel,
  //         depth,
  //         engine,
  //         fen: currentNode.fen,
  //       }).then((move) => {
  //         dispatch({
  //           type: "MAKE_MOVE",
  //           payload: parseUci(move),
  //         });
  //       });
  //     }
  //   }
  // }, [position, engine, playingColor]);

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
          viewOnly={opponent === null}
          disableVariations
          boardRef={boardRef}
          side={opponent === "human" ? undefined : playingColor}
          root={root}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        {opponent === null ? (
          <Paper withBorder shadow="sm" p="md" h="100%">
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
                  onClick={() => console.log(player1Settings, player2Settings)}
                >
                  Start game
                </Button>
              </Center>
            </Stack>
          </Paper>
        ) : (
          <>
            <GameInfo headers={headers} />
            <Group grow>
              <Button
                onClick={() => {
                  setOpponent(null);
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
          </>
        )}
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
