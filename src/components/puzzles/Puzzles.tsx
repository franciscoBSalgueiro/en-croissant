import { type PuzzleDatabaseInfo, commands } from "@/bindings";
import {
  activeTabAtom,
  currentPuzzleAtom,
  currentPuzzleTimerAtom,
  hidePuzzleRatingAtom,
  jumpToNextPuzzleAtom,
  progressivePuzzlesAtom,
  puzzleRatingRangeAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { formatTime } from "@/utils/format";
import {
  type Completion,
  type Puzzle,
  getPuzzleDatabases,
} from "@/utils/puzzles";
import { createTab } from "@/utils/tabs";
import { defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import {
  Accordion,
  ActionIcon,
  Button,
  Divider,
  Group,
  Paper,
  Portal,
  RangeSlider,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import {
  IconFlame,
  IconPlus,
  IconSettings,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
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

  const [settingsOpened, setSettingsOpened] = useState(false);

  useEffect(() => {
    getPuzzleDatabases().then((databases) => {
      setPuzzleDbs(databases);
    });
  }, []);

  const [ratingRange, setRatingRange] = useAtom(puzzleRatingRangeAtom);

  const [jumpToNextPuzzleImmediately, setJumpToNextPuzzleImmediately] =
    useAtom(jumpToNextPuzzleAtom);

  const wonPuzzles = puzzles.filter((p) => p.completion === "correct");
  const lostPuzzles = puzzles.filter((p) => p.completion === "incorrect");

  const totalCompleted = wonPuzzles.length + lostPuzzles.length;
  const accuracy =
    totalCompleted > 0
      ? Math.round((wonPuzzles.length / totalCompleted) * 100)
      : 0;

  let currentStreak = 0;
  for (let i = puzzles.length - 1; i >= 0; i--) {
    if (puzzles[i].completion === "correct") currentStreak++;
    else if (puzzles[i].completion === "incorrect") break;
  }

  const avgTimeSeconds =
    wonPuzzles.length > 0
      ? wonPuzzles.reduce((acc, p) => acc + (p.timeSpent || 0), 0) /
        wonPuzzles.length /
        1000
      : 0;

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
      setTimerStart(Date.now());
    });
  }

  function changeCompletion(completion: Completion) {
    const timeSpent = timerStart !== null ? Date.now() - timerStart : 0;
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      puzzles[currentPuzzle].timeSpent = timeSpent;
      return [...puzzles];
    });
    setTimerStart(null);
  }

  const [addOpened, setAddOpened] = useState(false);

  const [progressive, setProgressive] = useAtom(progressivePuzzlesAtom);
  const [hideRating, setHideRating] = useAtom(hidePuzzleRatingAtom);

  const [timerStart, setTimerStart] = useAtom(currentPuzzleTimerAtom);
  const [, setTick] = useState(0);

  const elapsedTime = timerStart !== null ? Date.now() - timerStart : 0;

  useEffect(() => {
    const currentPuzzleData = puzzles[currentPuzzle];
    if (!currentPuzzleData || currentPuzzleData.completion !== "incomplete") {
      return;
    }

    if (timerStart === null) {
      setTimerStart(Date.now());
    }

    const displayInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    const saveInterval = setInterval(() => {
      if (timerStart !== null) {
        const elapsed = Date.now() - timerStart;
        setPuzzles((puzzles) => {
          if (puzzles[currentPuzzle]?.completion === "incomplete") {
            puzzles[currentPuzzle].timeSpent = elapsed;
            return [...puzzles];
          }
          return puzzles;
        });
      }
    }, 1000);

    return () => {
      clearInterval(displayInterval);
      clearInterval(saveInterval);
    };
  }, [currentPuzzle, puzzles, timerStart, setTimerStart, setPuzzles]);

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
        <Paper
          h="100%"
          withBorder
          p="md"
          style={{
            overflow: "hidden",
          }}
        >
          <AddPuzzle
            puzzleDbs={puzzleDbs}
            opened={addOpened}
            setOpened={setAddOpened}
            setPuzzleDbs={setPuzzleDbs}
          />
          <Group justify="space-between">
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
              pb="sm"
            />
            <Tooltip label={t("SideBar.Settings")}>
              <ActionIcon onClick={() => setSettingsOpened((o) => !o)}>
                <IconSettings />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Accordion
            value={settingsOpened ? "settings" : null}
            onChange={(v) => setSettingsOpened(v === "settings")}
            mb="sm"
          >
            <Accordion.Item value="settings">
              <Accordion.Panel>
                <Stack gap="md">
                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      Rating Range
                    </Text>
                    <RangeSlider
                      min={600}
                      my="md"
                      max={2800}
                      value={ratingRange}
                      onChange={setRatingRange}
                      disabled={progressive}
                      marks={[
                        { value: 600, label: "600" },
                        { value: 1700, label: "1700" },
                        { value: 2800, label: "2800" },
                      ]}
                    />
                  </div>
                  <SimpleGrid cols={2} spacing="sm">
                    <Switch
                      label="Progressive"
                      description="Auto-increase difficulty"
                      checked={progressive}
                      onChange={(event) =>
                        setProgressive(event.currentTarget.checked)
                      }
                    />
                    <Switch
                      label="Hide Rating"
                      description="Hide until solved"
                      checked={hideRating}
                      onChange={(event) =>
                        setHideRating(event.currentTarget.checked)
                      }
                    />
                    <Switch
                      label={t("Puzzle.JumpToNextPuzzleImmediately")}
                      description="Auto-advance on solve"
                      checked={jumpToNextPuzzleImmediately}
                      onChange={(event) =>
                        setJumpToNextPuzzleImmediately(
                          event.currentTarget.checked,
                        )
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Group grow>
            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                Rating
              </Text>
              <Text fw={700} size="lg">
                {puzzles[currentPuzzle]?.completion === "incomplete"
                  ? hideRating
                    ? "?"
                    : puzzles[currentPuzzle]?.rating
                  : puzzles[currentPuzzle]?.rating || "-"}
              </Text>
            </Paper>

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                Time
              </Text>
              <Text fw={700} size="lg" ff="monospace">
                {puzzles[currentPuzzle]?.completion === "incomplete"
                  ? formatTime(elapsedTime)
                  : puzzles[currentPuzzle]?.timeSpent
                    ? formatTime(puzzles[currentPuzzle].timeSpent!)
                    : "-"}
              </Text>
            </Paper>

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                Accuracy
              </Text>
              <Text fw={700} size="lg" c={accuracy >= 50 ? "teal" : "orange"}>
                {accuracy}%
              </Text>
            </Paper>

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                Streak
              </Text>
              <Group gap={2}>
                <Text fw={700} size="lg">
                  {currentStreak}
                </Text>
                <IconFlame size={20} color="orange" />
              </Group>
            </Paper>

            {avgTimeSeconds > 0 && (
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  Avg Time
                </Text>
                <Text fw={700} size="lg">
                  {avgTimeSeconds.toFixed(1)}s
                </Text>
              </Paper>
            )}
          </Group>
          <Divider my="sm" />
          <Group justify="space-between">
            <Text fz="1.75rem" fw={500}>
              {!turnToMove
                ? ""
                : turnToMove === "white"
                  ? "Black to move"
                  : "White to move"}
            </Text>
            <Group gap="xs">
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
                          parseFen(puzzles[currentPuzzle].fen).unwrap().turn ===
                          "white"
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
                    setTimerStart(null);
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
            fullWidth
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
                  if (puzzles[i].completion === "incomplete") {
                    setTimerStart(Date.now() - (puzzles[i].timeSpent || 0));
                  } else {
                    setTimerStart(null);
                  }
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
