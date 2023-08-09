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
import BoardLayout from "@/layouts/BoardLayout";
import { parseUci } from "@/utils/chess";
import { Engine, getEngines } from "@/utils/engines";
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
import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { useAtom, useAtomValue } from "jotai";
import { match } from "ts-pattern";

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

function BoardGame() {
  const activeTab = useAtomValue(activeTabAtom);
  const [opponent, setOpponent] = useSessionStorage<Opponent | null>({
    key: activeTab + "-opponent",
    defaultValue: null,
  });
  const [selected, setSelected] = useState<Opponent | null>(null);
  const { headers, root, position } = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentNode = getNodeAtPath(root, position);
  const [, setTabs] = useAtom(tabsAtom);

  const boardRef = useRef(null);

  const [engines, setEngines] = useState<Engine[]>([]);
  const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
    "white"
  );
  const [playingColor, setPlayingColor] = useState<"white" | "black">("white");
  const [engine, setEngine] = useState<string | null>(null);

  const chess = new Chess(currentNode.fen);

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.value === activeTab ? { ...tab, type: "analysis" } : tab
      )
    );
  }

  useEffect(() => {
    getEngines().then((engines) => {
      setEngines(engines);
    });
  }, []);

  useEffect(() => {
    const isBotTurn = match(playingColor)
      .with("black", () => chess.turn() === "w")
      .with("white", () => chess.turn() === "b")
      .exhaustive();
    if (
      currentNode.children.length === 0 &&
      opponent &&
      opponent !== Opponent.Human &&
      isBotTurn &&
      !chess.isGameOver()
    ) {
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
        const engineLevel = match(opponent)
          .with(Opponent.Easy, () => 2)
          .with(Opponent.Medium, () => 4)
          .with(Opponent.Hard, () => 6)
          .with(Opponent.Impossible, () => 8)
          .exhaustive();
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
          dirty={false}
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
