import {
  activeTabAtom,
  currentPuzzleAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
} from "@/atoms/atoms";
import { commands } from "@/bindings";
import { parseUci } from "@/utils/chess";
import { unwrap } from "@/utils/invoke";
import {
  Completion,
  Puzzle,
  PuzzleDatabase,
  getPuzzleDatabases,
} from "@/utils/puzzles";
import { createTab } from "@/utils/tabs";
import { defaultTree } from "@/utils/treeReducer";
import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Input,
  Paper,
  Portal,
  RangeSlider,
  ScrollArea,
  Select,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useLocalStorage, useSessionStorage } from "@mantine/hooks";
import { IconPlus, IconX, IconZoomCheck } from "@tabler/icons-react";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import { useAtom, useSetAtom } from "jotai";
import { useContext, useEffect, useState } from "react";
import GameNotation from "../boards/GameNotation";
import ChallengeHistory from "../common/ChallengeHistory";
import MoveControls from "../common/MoveControls";
import { TreeDispatchContext } from "../common/TreeStateContext";
import AddPuzzle from "./AddPuzzle";
import PuzzleBoard from "./PuzzleBoard";

function Puzzles({ id }: { id: string }) {
  const dispatch = useContext(TreeDispatchContext);
  const [puzzles, setPuzzles] = useSessionStorage<Puzzle[]>({
    key: id + "-puzzles",
    defaultValue: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useAtom(currentPuzzleAtom);

  const [puzzleDbs, setPuzzleDbs] = useState<PuzzleDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useAtom(selectedPuzzleDbAtom);

  useEffect(() => {
    getPuzzleDatabases().then((databases) => {
      setPuzzleDbs(databases);
    });
  }, []);

  const [ratingRange, setRatingRange] = useLocalStorage<[number, number]>({
    key: "puzzle-ratings",
    defaultValue: [1000, 1500],
  });

  const wonPuzzles = puzzles.filter(
    (puzzle) => puzzle.completion === "correct",
  );
  const lostPuzzles = puzzles.filter(
    (puzzle) => puzzle.completion === "incorrect",
  );
  const averageWonRating =
    wonPuzzles.reduce((acc, puzzle) => acc + puzzle.rating, 0) /
    wonPuzzles.length;
  const averageLostRating =
    lostPuzzles.reduce((acc, puzzle) => acc + puzzle.rating, 0) /
    lostPuzzles.length;

  function setPuzzle(puzzle: { fen: string; moves: string[] }) {
    dispatch({ type: "SET_FEN", payload: puzzle.fen });
    dispatch({ type: "MAKE_MOVE", payload: parseUci(puzzle.moves[0]) });
  }

  function generatePuzzle(db: string) {
    let range = ratingRange;
    if (progressive) {
      const rating = puzzles[currentPuzzle]?.rating;
      if (rating) {
        range = [rating + 50, rating + 100];
        setRatingRange([rating + 50, rating + 100]);
      }
    }
    commands.getPuzzle(db, range[0], range[1]).then((res) => {
      const puzzle = unwrap(res);
      const newPuzzle: Puzzle = {
        ...puzzle,
        moves: puzzle.moves.split(" "),
        completion: "incomplete",
      };
      setPuzzles((puzzles) => {
        return [...puzzles, newPuzzle];
      });
      setCurrentPuzzle(puzzles.length);
      setPuzzle(newPuzzle);
    });
  }

  function changeCompletion(completion: Completion) {
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      return [...puzzles];
    });
  }

  const [addOpened, setAddOpened] = useState(false);
  const [progressive, setProgressive] = useState(false);

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
        <PuzzleBoard
          key={currentPuzzle}
          puzzles={puzzles}
          currentPuzzle={currentPuzzle}
          changeCompletion={changeCompletion}
          generatePuzzle={generatePuzzle}
          db={selectedDb}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper h="100%" withBorder p="md">
          <AddPuzzle
            puzzleDbs={puzzleDbs}
            opened={addOpened}
            setOpened={setAddOpened}
            setPuzzleDbs={setPuzzleDbs}
          />
          <Group grow>
            <div>
              <Text size="sm" c="dimmed">
                Puzzle Rating
              </Text>
              <Text fw={500} size="xl">
                {puzzles[currentPuzzle]?.rating}
              </Text>
            </div>
            {averageWonRating && (
              <div>
                <Text size="sm" c="dimmed">
                  Average Success Rating
                </Text>
                <Text fw={500} size="xl">
                  {averageWonRating.toFixed(0)}
                </Text>
              </div>
            )}
            {averageLostRating && (
              <div>
                <Text size="sm" c="dimmed">
                  Average Fail Rating
                </Text>
                <Text fw={500} size="xl">
                  {averageLostRating.toFixed(0)}
                </Text>
              </div>
            )}
            <Select
              data={puzzleDbs
                .map((p) => ({
                  label: p.title.split(".db3")[0],
                  value: p.path,
                }))
                .concat({ label: "+ Add new", value: "add" })}
              value={selectedDb}
              clearable={false}
              placeholder="Select database"
              onChange={(v) => {
                if (v === "add") {
                  setAddOpened(true);
                } else {
                  setSelectedDb(v);
                }
              }}
            />
          </Group>
          <Divider my="sm" />
          <Group>
            <Input.Wrapper label="Rating Range" flex={1}>
              <RangeSlider
                min={600}
                max={2800}
                value={ratingRange}
                onChange={setRatingRange}
                disabled={progressive}
              />
            </Input.Wrapper>
            <Input.Wrapper label="Progressive">
              <Center>
                <Checkbox
                  checked={progressive}
                  onChange={(event) =>
                    setProgressive(event.currentTarget.checked)
                  }
                />
              </Center>
            </Input.Wrapper>
          </Group>
          <Divider my="sm" />
          <Group>
            <Tooltip label="New Puzzle">
              <ActionIcon
                disabled={!selectedDb}
                onClick={() => generatePuzzle(selectedDb!)}
              >
                <IconPlus />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Analyze Position">
              <ActionIcon
                disabled={!selectedDb}
                onClick={() =>
                  createTab({
                    tab: {
                      name: "Puzzle Analysis",
                      type: "analysis",
                    },
                    setTabs,
                    setActiveTab,
                    pgn: puzzles[currentPuzzle]?.moves.join(" "),
                    headers: {
                      ...defaultTree().headers,
                      fen: puzzles[currentPuzzle]?.fen,
                      orientation:
                        Chess.fromSetup(
                          parseFen(puzzles[currentPuzzle].fen).unwrap(),
                        ).unwrap().turn === "white"
                          ? "black"
                          : "white",
                    },
                  })
                }
              >
                <IconZoomCheck />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Clear Session">
              <ActionIcon
                onClick={() => {
                  setPuzzles([]);
                  dispatch({ type: "RESET" });
                }}
              >
                <IconX />
              </ActionIcon>
            </Tooltip>
            <Button
              onClick={async () => {
                const curPuzzle = puzzles[currentPuzzle];
                if (curPuzzle.completion === "incomplete") {
                  changeCompletion("incorrect");
                }
                dispatch({
                  type: "GO_TO_START",
                });
                for (let i = 0; i < curPuzzle.moves.length; i++) {
                  dispatch({
                    type: "MAKE_MOVE",
                    payload: parseUci(curPuzzle.moves[i]),
                    mainline: true,
                  });
                  await new Promise((r) => setTimeout(r, 500));
                }
              }}
              disabled={puzzles.length === 0}
            >
              View Solution
            </Button>
          </Group>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        <Stack h="100%" gap="xs">
          <Paper withBorder p="md" mih="5rem">
            <ScrollArea h="100%" offsetScrollbars>
              <ChallengeHistory
                challenges={puzzles.map((p) => ({
                  ...p,
                  label: p.rating.toString(),
                }))}
                current={currentPuzzle}
                select={(i) => {
                  setCurrentPuzzle(i);
                  setPuzzle(puzzles[i]);
                }}
              />
            </ScrollArea>
          </Paper>
          <Stack flex={1}>
            <GameNotation />
            <MoveControls />
          </Stack>
        </Stack>
      </Portal>
    </>
  );
}

export default Puzzles;
