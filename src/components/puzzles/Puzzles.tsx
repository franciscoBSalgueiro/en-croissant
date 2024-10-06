import { type PuzzleDatabaseInfo, commands } from "@/bindings";
import {
  activeTabAtom,
  currentPuzzleAtom,
  hidePuzzleRatingAtom,
  jumpToNextPuzzleAtom,
  progressivePuzzlesAtom,
  puzzleRatingRangeAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import {
  type Completion,
  type Puzzle,
  getPuzzleDatabases,
} from "@/utils/puzzles";
import { createTab } from "@/utils/tabs";
import { defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
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
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { IconPlus, IconX, IconZoomCheck } from "@tabler/icons-react";
import { Chess, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { useAtom, useSetAtom } from "jotai";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import ChallengeHistory from "../common/ChallengeHistory";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AddPuzzle from "./AddPuzzle";
import PuzzleBoard from "./PuzzleBoard";

function Puzzles({ id }: { id: string }) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const setFen = useStore(store, (s) => s.setFen);
  const goToStart = useStore(store, (s) => s.goToStart);
  const reset = useStore(store, (s) => s.reset);
  const makeMove = useStore(store, (s) => s.makeMove);
  const [puzzles, setPuzzles] = useSessionStorage<Puzzle[]>({
    key: `${id}-puzzles`,
    defaultValue: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useAtom(currentPuzzleAtom);

  const [puzzleDbs, setPuzzleDbs] = useState<PuzzleDatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useAtom(selectedPuzzleDbAtom);

  useEffect(() => {
    getPuzzleDatabases().then((databases) => {
      setPuzzleDbs(databases);
    });
  }, []);

  const [ratingRange, setRatingRange] = useAtom(puzzleRatingRangeAtom);

  const [jumpToNextPuzzleImmediately, setJumpToNextPuzzleImmediately] =
    useAtom(jumpToNextPuzzleAtom);

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
    setFen(puzzle.fen);
    makeMove({ payload: parseUci(puzzle.moves[0])! });
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

  const [progressive, setProgressive] = useAtom(progressivePuzzlesAtom);
  const [hideRating, setHideRating] = useAtom(hidePuzzleRatingAtom);

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const turnToMove =
    puzzles[currentPuzzle] !== undefined
      ? positionFromFen(puzzles[currentPuzzle]?.fen)[0]?.turn
      : null;

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
                {puzzles[currentPuzzle]?.completion === "incomplete"
                  ? hideRating
                    ? "?"
                    : puzzles[currentPuzzle]?.rating
                  : puzzles[currentPuzzle]?.rating}
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
            <Input.Wrapper label="Hide Rating">
              <Center>
                <Checkbox
                  checked={hideRating}
                  onChange={(event) =>
                    setHideRating(event.currentTarget.checked)
                  }
                />
              </Center>
            </Input.Wrapper>
          </Group>
          <Divider my="sm" />
          <Group justify="space-between">
            {turnToMove && (
              <Text fz="1.75rem">
                {turnToMove === "white" ? "Black " : "White "}
                To Move
              </Text>
            )}
            <Group>
              <Switch
                defaultChecked
                onChange={(event) =>
                  setJumpToNextPuzzleImmediately(event.currentTarget.checked)
                }
                checked={jumpToNextPuzzleImmediately}
                label={t("Puzzle.JumpToNextPuzzleImmediately")}
              />

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
                    reset();
                  }}
                >
                  <IconX />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Button
            mt="sm"
            variant="light"
            onClick={async () => {
              const curPuzzle = puzzles[currentPuzzle];
              if (curPuzzle.completion === "incomplete") {
                changeCompletion("incorrect");
              }
              goToStart();
              for (let i = 0; i < curPuzzle.moves.length; i++) {
                makeMove({
                  payload: parseUci(curPuzzle.moves[i])!,
                  mainline: true,
                });
                await new Promise((r) => setTimeout(r, 500));
              }
            }}
            disabled={puzzles.length === 0}
          >
            View Solution
          </Button>
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
          <Stack flex={1} gap="xs">
            <GameNotation />
            <MoveControls readOnly />
          </Stack>
        </Stack>
      </Portal>
    </>
  );
}

export default Puzzles;
