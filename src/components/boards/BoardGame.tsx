import {
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import {
  IconDice,
  IconPlus,
  IconRobot,
  IconUsers,
  IconZoomCheck,
} from "@tabler/icons-react";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { useContext, useEffect, useRef, useState } from "react";
import BoardLayout from "@/layouts/BoardLayout";
import { parseUci } from "@/utils/chess";
import { invoke } from "@/utils/invoke";
import { getNodeAtPath } from "@/utils/treeReducer";
import GameInfo from "../common/GameInfo";
import GenericCard from "../common/GenericCard";
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

type Opponent = {
  id: string;
  name: string;
  settings?: {
    skillLevel: number;
    depth: number;
  };
  icon: React.FC;
};

const opponentPresets: Opponent[] = [
  {
    id: "random",
    name: "Random Bot",
    icon: IconDice,
  },
  {
    id: "easy",
    name: "Easy Bot",
    settings: {
      skillLevel: 2,
      depth: 12,
    },
    icon: IconRobot,
  },
  {
    id: "medium",
    name: "Medium Bot",
    settings: {
      skillLevel: 4,
      depth: 16,
    },
    icon: IconRobot,
  },
  {
    id: "hard",
    name: "Hard Bot",
    settings: {
      skillLevel: 6,
      depth: 20,
    },
    icon: IconRobot,
  },
  {
    id: "impossible",
    name: "Impossible Bot",
    settings: {
      skillLevel: 8,
      depth: 24,
    },
    icon: IconRobot,
  },
  {
    id: "human",
    name: "Human",
    icon: IconUsers,
  },
];

interface OpponentCardProps {
  Icon: React.FC;
  opponent: Opponent;
  isSelected: boolean;
  setSelected: React.Dispatch<React.SetStateAction<Opponent | null>>;
  setSkillLevel: React.Dispatch<React.SetStateAction<number | null>>;
  setDepth: React.Dispatch<React.SetStateAction<number | null>>;
}

function OpponentCard({
  opponent,
  isSelected,
  Icon,
  setSelected,
  setSkillLevel,
  setDepth,
}: OpponentCardProps) {
  const updateSettings = (opponent: Opponent) => {
    setSkillLevel(opponent.settings?.skillLevel ?? null);
    setDepth(opponent.settings?.depth ?? null);
    setSelected(opponent);
  };

  return (
    <GenericCard
      id={opponent}
      isSelected={isSelected}
      setSelected={updateSettings}
      Header={
        <Group noWrap>
          <Icon />
          <Text weight={500}>{opponent.name}</Text>
        </Group>
      }
    />
  );
}

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const [opponent, setOpponent] = useSessionStorage<string | null>({
    key: activeTab + "-opponent",
    defaultValue: null,
  });
  const [selected, setSelected] = useState<Opponent | null>(null);
  const { headers, root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentNode = getNodeAtPath(root, position);
  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);

  const engines = useAtomValue(enginesAtom);
  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white"
  );
  const [playingColor, setPlayingColor] = useState<"white" | "black">("white");
  const [engine, setEngine] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<number | null>(null);
  const [depth, setDepth] = useState<number | null>(null);

  const chess = new Chess(currentNode.fen);

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab
      )
    );
  }

  useEffect(() => {
    const isBotTurn = match(playingColor)
      .with("black", () => chess.turn() === "w")
      .with("white", () => chess.turn() === "b")
      .exhaustive();
    if (
      currentNode.children.length === 0 &&
      opponent &&
      opponent !== "human" &&
      isBotTurn &&
      !chess.isGameOver()
    ) {
      if (opponent === "random") {
        invoke<string>("make_random_move", {
          fen: currentNode.fen,
        }).then((move) => {
          dispatch({
            type: "MAKE_MOVE",
            payload: parseUci(move),
          });
        });
      } else if (engine) {
        invoke<string>("get_single_best_move", {
          skillLevel,
          depth,
          engine,
          fen: currentNode.fen,
        }).then((move) => {
          dispatch({
            type: "MAKE_MOVE",
            payload: parseUci(move),
          });
        });
      }
    }
  }, [position, engine, playingColor]);

  const [notationExpanded, setNotationExpanded] = useState(false);

  return (
    <BoardLayout
      board={
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
      }
    >
      {opponent === null ? (
        <Card shadow="sm" p="md">
          <Text fw="bold" mb="md">
            Choose an opponent
          </Text>
          <SimpleGrid cols={3} spacing="md">
            {opponentPresets.map((opponent) => (
              <OpponentCard
                key={opponent.id}
                opponent={opponent}
                isSelected={selected?.id === opponent.id}
                setSelected={setSelected}
                setSkillLevel={setSkillLevel}
                setDepth={setDepth}
                Icon={opponent.icon}
              />
            ))}
          </SimpleGrid>
          {selected?.settings && (
            <Group align="baseline">
              <Select
                mt="md"
                w={200}
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

              <NumberInput
                label="Skill Level"
                value={skillLevel ?? 0}
                onChange={(e) => setSkillLevel(e as number)}
              />

              <NumberInput
                label="Depth"
                value={depth ?? 0}
                onChange={(e) => setDepth(e as number)}
              />
            </Group>
          )}

          <Select
            mt="md"
            w={200}
            label="Color"
            data={[
              { value: "white", label: "White" },
              { value: "random", label: "Random" },
              { value: "black", label: "Black" },
            ]}
            value={inputColor}
            onChange={(e) => {
              setInputColor(e as "white" | "black" | "random");
            }}
          />

          <Divider my="md" />
          <Button
            disabled={
              selected === null || (selected.settings && engine === null)
            }
            onClick={() => {
              setPlayingColor(
                inputColor === "random"
                  ? Math.random() > 0.5
                    ? "white"
                    : "black"
                  : inputColor
              );
              setOpponent(selected!.id);
              dispatch({
                type: "SET_FEN",
                payload: DEFAULT_POSITION,
              });
            }}
          >
            Play
          </Button>
        </Card>
      ) : (
        <>
          {!notationExpanded && (
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

          <GameNotation
            boardSize={notationExpanded ? 1750 : 600}
            notationExpanded={notationExpanded}
            setNotationExpanded={setNotationExpanded}
            topBar
          />
          <MoveControls />
        </>
      )}
    </BoardLayout>
  );
}

export default BoardGame;
