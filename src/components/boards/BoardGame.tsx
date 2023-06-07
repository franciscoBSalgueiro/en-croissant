import {
  Button,
  Card,
  Divider,
  Group,
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
import BoardLayout from "../../layouts/BoardLayout";
import { parseUci } from "../../utils/chess";
import { Outcome } from "../../utils/db";
import { Engine, getEngines } from "../../utils/engines";
import { invoke } from "../../utils/misc";
import { Tab } from "../../utils/tabs";
import { getNodeAtPath } from "../../utils/treeReducer";
import GameInfo from "../common/GameInfo";
import GenericCard from "../common/GenericCard";
import MoveControls from "../common/MoveControls";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import BoardPlay from "./BoardPlay";
import GameNotation from "./GameNotation";

enum Opponent {
  Random = "Random Bot",
  Easy = "Easy Bot",
  Medium = "Medium Bot",
  Hard = "Hard Bot",
  Impossible = "Impossible Bot",
  Human = "Human",
}

interface OpponentCardProps {
  Icon: React.FC;
  opponent: Opponent;
  isSelected: boolean;
  setSelected: React.Dispatch<React.SetStateAction<Opponent | null>>;
}

function OpponentCard({
  opponent,
  isSelected,
  Icon,
  setSelected,
}: OpponentCardProps) {
  return (
    <GenericCard
      id={opponent}
      isSelected={isSelected}
      setSelected={setSelected}
      Header={
        <Group noWrap>
          <Icon />
          <Text weight={500}>{opponent}</Text>
        </Group>
      }
    />
  );
}

function BoardGame({
  id,
  tabs,
  setTabs,
}: {
  id: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}) {
  const [opponent, setOpponent] = useSessionStorage<Opponent | null>({
    key: id + "-opponent",
    defaultValue: null,
  });
  const [selected, setSelected] = useState<Opponent | null>(null);
  const { headers, root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentNode = getNodeAtPath(root, position);

  const boardRef = useRef(null);

  const [engines, setEngines] = useState<Engine[]>([]);
  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white"
  );
  const [playingColor, setPlayingColor] = useState<"white" | "black">("white");
  const [engine, setEngine] = useState<string | null>(null);
  if (!currentNode) {
    return <></>;
  }

  const chess = new Chess(currentNode.fen);

  function changeToAnalysisMode() {
    setTabs(
      tabs.map((tab) => (tab.value === id ? { ...tab, type: "analysis" } : tab))
    );
  }

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);

  useEffect(() => {
    let isBotTurn = false;
    if (playingColor === "black") {
      isBotTurn = chess.turn() === "w";
    } else if (playingColor === "white") {
      isBotTurn = chess.turn() === "b";
    }
    if (
      currentNode.children.length === 0 &&
      opponent &&
      opponent !== Opponent.Human &&
      isBotTurn &&
      !chess.isGameOver()
    ) {
      let engineLevel;
      if (opponent === Opponent.Random) {
        invoke<string>("make_random_move", {
          fen: currentNode.fen,
        }).then((move) => {
          dispatch({
            type: "MAKE_MOVE",
            payload: parseUci(move),
          });
        });
      } else if (engine) {
        if (opponent === Opponent.Easy) {
          engineLevel = 2;
        } else if (opponent === Opponent.Medium) {
          engineLevel = 4;
        } else if (opponent === Opponent.Hard) {
          engineLevel = 6;
        } else if (opponent === Opponent.Impossible) {
          engineLevel = 8;
        }
        invoke<string>("get_single_best_move", {
          difficulty: engineLevel,
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
          currentNode={currentNode}
          arrows={[]}
          headers={headers}
          editingMode={false}
          toggleEditingMode={() => undefined}
          viewOnly={opponent === null}
          disableVariations
          boardRef={boardRef}
          side={playingColor}
        />
      }
    >
      {opponent === null ? (
        <Card shadow="sm" p="md">
          <Text fw="bold" mb="md">
            Choose an opponent
          </Text>
          <SimpleGrid cols={3} spacing="md">
            <OpponentCard
              opponent={Opponent.Random}
              isSelected={selected === Opponent.Random}
              setSelected={setSelected}
              Icon={IconDice}
            />
            <OpponentCard
              opponent={Opponent.Easy}
              isSelected={selected === Opponent.Easy}
              setSelected={setSelected}
              Icon={IconRobot}
            />
            <OpponentCard
              opponent={Opponent.Medium}
              isSelected={selected === Opponent.Medium}
              setSelected={setSelected}
              Icon={IconRobot}
            />
            <OpponentCard
              opponent={Opponent.Hard}
              isSelected={selected === Opponent.Hard}
              setSelected={setSelected}
              Icon={IconRobot}
            />
            <OpponentCard
              opponent={Opponent.Impossible}
              isSelected={selected === Opponent.Impossible}
              setSelected={setSelected}
              Icon={IconRobot}
            />
            <OpponentCard
              opponent={Opponent.Human}
              isSelected={selected === Opponent.Human}
              setSelected={setSelected}
              Icon={IconUsers}
            />
          </SimpleGrid>
          {(selected === Opponent.Easy ||
            selected === Opponent.Medium ||
            selected === Opponent.Hard ||
            selected === Opponent.Impossible) && (
            <Select
              mt="md"
              w={200}
              label="Engine"
              data={engines.map((engine) => ({
                label: engine.name,
                value: engine.path,
              }))}
              value={engine}
              onChange={(e) => {
                setEngine(e);
              }}
            />
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
              selected === null ||
              ((selected === Opponent.Easy ||
                selected === Opponent.Medium ||
                selected === Opponent.Hard ||
                selected === Opponent.Impossible) &&
                engine === null)
            }
            onClick={() => {
              setPlayingColor(
                inputColor === "random"
                  ? Math.random() > 0.5
                    ? "white"
                    : "black"
                  : inputColor
              );
              setOpponent(selected);
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
                        result: Outcome.Unknown,
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
          />
          <MoveControls />
        </>
      )}
    </BoardLayout>
  );
}

export default BoardGame;
