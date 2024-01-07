import {
  ActionIcon,
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Group,
  Input,
  Loader,
  Paper,
  Portal,
  RangeSlider,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useLocalStorage, useSessionStorage } from "@mantine/hooks";
import { IconPlus, IconX, IconZoomCheck } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { unwrap } from "@/utils/invoke";
import {
  Completion,
  Puzzle,
  PuzzleDatabase,
  getPuzzleDatabases,
} from "@/utils/puzzles";
import PuzzleBoard from "./PuzzleBoard";
import { PuzzleDbCard } from "./PuzzleDbCard";
import AddPuzzle from "./AddPuzzle";
import ChallengeHistory from "../common/ChallengeHistory";
import { commands } from "@/bindings";
import { atom, useAtom, useSetAtom } from "jotai";
import { activeTabAtom, selectedPuzzleDbAtom, tabsAtom } from "@/atoms/atoms";
import * as classes from "@/components/common/GenericCard.css";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "../common/TreeStateContext";
import { parseUci } from "@/utils/chess";
import GameNotation from "../boards/GameNotation";
import MoveControls from "../common/MoveControls";
import { countMainPly, defaultTree } from "@/utils/treeReducer";
import { createTab } from "@/utils/tabs";

const currentPuzzleAtom = atom<number>(0);

function Puzzles({ id }: { id: string }) {
  const tree = useContext(TreeStateContext);
  const dispatch = useContext(TreeDispatchContext);
  const currentMove = countMainPly(tree.root);
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
    (puzzle) => puzzle.completion === "correct"
  );
  const lostPuzzles = puzzles.filter(
    (puzzle) => puzzle.completion === "incorrect"
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
  const [loading, setLoading] = useState(false);
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
            setLoading={setLoading}
            setPuzzleDbs={setPuzzleDbs}
          />
          <SimpleGrid cols={2} mb="md">
            {puzzleDbs.map((db) => (
              <PuzzleDbCard
                key={db.path}
                db={db}
                isSelected={selectedDb === db.path}
                setSelected={setSelectedDb}
              />
            ))}
            <Box
              className={classes.card}
              component="button"
              type="button"
              onClick={() => setAddOpened(true)}
            >
              <Text fw={500} mb={10}>
                Add New
              </Text>
              {loading ? (
                <Loader variant="dots" size="2rem" />
              ) : (
                <IconPlus size="2rem" />
              )}
            </Box>
          </SimpleGrid>
          <Group>
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
                  Average Won Rating
                </Text>
                <Text fw={500} size="xl">
                  {averageWonRating.toFixed(0)}
                </Text>
              </div>
            )}
            {averageLostRating && (
              <div>
                <Text size="sm" c="dimmed">
                  Average Lost Rating
                </Text>
                <Text fw={500} size="xl">
                  {averageLostRating.toFixed(0)}
                </Text>
              </div>
            )}
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
                    headers:  { ...defaultTree().headers, fen: puzzles[currentPuzzle]?.fen },
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
                  setSelectedDb(null);
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
                for (let i = currentMove; i < curPuzzle.moves.length; i++) {
                  dispatch({
                    type: "MAKE_MOVE",
                    payload: parseUci(curPuzzle.moves[i]),
                  });
                  await new Promise((r) => setTimeout(r, 500));
                }
              }}
              disabled={
                puzzles.length === 0 ||
                currentMove === puzzles[currentPuzzle].moves.length
              }
            >
              View Solution
            </Button>
          </Group>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        <Stack h="100%" gap="xs">
          <Paper withBorder p="md" mih="5rem">
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
