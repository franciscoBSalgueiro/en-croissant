import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
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
  IconAlertTriangle,
  IconFlame,
  IconPlus,
  IconSettings,
  IconTrash,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import { parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { useAtom, useSetAtom } from "jotai";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { commands, type PuzzleDatabaseInfo } from "@/bindings";
import {
  activeTabAtom,
  currentPuzzleAtom,
  currentPuzzleTimerAtom,
  hidePuzzleRatingAtom,
  jumpToNextPuzzleAtom,
  trackPuzzleTimeAtom,
  progressivePuzzlesAtom,
  puzzleRatingRangeAtom,
  puzzleThemeAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { formatThemeLabel, formatTime } from "@/utils/format";
import {
  type Completion,
  getPuzzleDatabases,
  type Puzzle,
} from "@/utils/puzzles";
import { createTab } from "@/utils/tabs";
import { defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import ChallengeHistory from "../common/ChallengeHistory";
import ConfirmModal from "../common/ConfirmModal";
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

  const [selectedTheme, setSelectedTheme] = useAtom(puzzleThemeAtom);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [themesTableMissing, setThemesTableMissing] = useState(false);

  useEffect(() => {
    setSelectedTheme(null);
    setThemesTableMissing(false);

    if (!selectedDb) {
      setAvailableThemes([]);
      return;
    }

    commands.getPuzzleThemes(selectedDb).then((res) => {
      if (res.status === "ok") {
        setAvailableThemes(res.data);
        return;
      }

      setAvailableThemes([]);

      if (
        typeof res.error === "string" &&
        res.error.includes("no such table")
      ) {
        setThemesTableMissing(true);
      }
    });
  }, [selectedDb, setSelectedTheme]);

  const [jumpToNextPuzzleImmediately, setJumpToNextPuzzleImmediately] =
    useAtom(jumpToNextPuzzleAtom);

  const wonPuzzles = puzzles.filter((p) => p.completion === "correct");
  const lostPuzzles = puzzles.filter((p) => p.completion === "incorrect");

  const totalCompleted = wonPuzzles.length + lostPuzzles.length;
  const accuracy =
    totalCompleted > 0
      ? Math.round((wonPuzzles.length / totalCompleted) * 100)
      : null;

  let currentStreak = 0;
  for (let i = puzzles.length - 1; i >= 0; i--) {
    if (puzzles[i].completion === "correct") currentStreak++;
    else if (puzzles[i].completion === "incorrect") break;
  }

  const avgTimeSeconds =
    wonPuzzles.length > 0
      ? wonPuzzles.filter((p) => p.timeSpent).reduce((acc, p) => acc + (p.timeSpent || 0), 0) /
      wonPuzzles.length /
      1000
      : 0;

  function setPuzzle(puzzle: { fen: string; moves: string[] }) {
    setFen(puzzle.fen);
    makeMove({ payload: parseUci(puzzle.moves[0])! });
  }

  const solutionAbortRef = useRef<AbortController | null>(null);

  function generatePuzzle(db: string) {
    let nextIndex = puzzles.findIndex(
      (p, i) => i > currentPuzzle && p.completion === "incomplete",
    );
    if (nextIndex === -1) {
      nextIndex = puzzles.findIndex(
        (p, i) => i < currentPuzzle && p.completion === "incomplete",
      );
    }

    if (nextIndex !== -1) {
      solutionAbortRef.current?.abort();
      setCurrentPuzzle(nextIndex);
      setPuzzle(puzzles[nextIndex]);
      // Only start the timer if tracking is on
      if (trackTime) {
        setTimerStart(Date.now() - (puzzles[nextIndex].timeSpent || 0));
      }
      return;
    }

    solutionAbortRef.current?.abort();

    let range = ratingRange;
    if (progressive) {
      const rating = puzzles[currentPuzzle]?.rating;
      if (rating) {
        range = [rating + 50, rating + 100];
        setRatingRange([rating + 50, rating + 100]);
      }
    }
    commands
      .getPuzzle(db, range[0], range[1], selectedTheme ?? null)
      .then((res) => {
        const puzzle = unwrap(res);
        const newPuzzle: Puzzle = {
          ...puzzle,
          moves: puzzle.moves.split(" "),
          completion: "incomplete",
        };
        setPuzzles((puzzles) => {
          setCurrentPuzzle(puzzles.length);
          setPuzzle(newPuzzle);
          // Only start the timer if tracking is on
          if (trackTime) {
            setTimerStart(Date.now());
          }
          return [...puzzles, newPuzzle];
        });
      });
  }

  function changeCompletion(completion: Completion) {
    const timeSpent = timerStart !== null ? Date.now() - timerStart : 0;
    const puzzle = puzzles[currentPuzzle];
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      puzzles[currentPuzzle].timeSpent = timeSpent;
      return [...puzzles];
    });
    setTimerStart(null);

    if (selectedDb && puzzle?.id) {
      commands.getThemesForPuzzle(selectedDb, puzzle.id).then((res) => {
        if (res.status === "ok") {
          setPuzzles((puzzles) => {
            puzzles[currentPuzzle].themes = res.data;
            return [...puzzles];
          });
        }
      });
    }
  }

  const [addOpened, setAddOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);

  const [progressive, setProgressive] = useAtom(progressivePuzzlesAtom);
  const [hideRating, setHideRating] = useAtom(hidePuzzleRatingAtom);
  const [trackTime, setTrackTime] = useAtom(trackPuzzleTimeAtom);

  const [timerStart, setTimerStart] = useAtom(currentPuzzleTimerAtom);
  const [, setTick] = useState(0);

  // for the UI.
  const isPuzzleIncomplete = puzzles[currentPuzzle]?.completion === "incomplete";
  const elapsedTime = timerStart && isPuzzleIncomplete && trackTime
    ? Date.now() - timerStart
    : (puzzles[currentPuzzle]?.timeSpent || 0);

  // set timer start
  useEffect(() => {
    if (trackTime && isPuzzleIncomplete && timerStart === null) {
      setTimerStart(Date.now());
    }
  }, [trackTime, isPuzzleIncomplete, timerStart, setTimerStart]);

  // UI Ticks
  useEffect(() => {
    if (!trackTime || !isPuzzleIncomplete || timerStart === null) return;

    const displayInterval = setInterval(() => {
      setTick((t) => t + 1); // Forces a re-render so the UI updates
    }, 100);

    return () => clearInterval(displayInterval);
  }, [trackTime, isPuzzleIncomplete, timerStart]);

  // saving on unmount or puzzle change
  useEffect(() => {
    return () => {
      // when the user leaves or switches puzzles
      if (trackTime && timerStart !== null && isPuzzleIncomplete) {
        const finalElapsed = Date.now() - timerStart;
        setPuzzles((prev) => {
          const newPuzzles = [...prev];
          if (newPuzzles[currentPuzzle]) {
            newPuzzles[currentPuzzle].timeSpent = finalElapsed;
          }
          return newPuzzles;
        });
      }
    };
  }, [trackTime, timerStart, currentPuzzle, isPuzzleIncomplete, setPuzzles]);

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
          <ConfirmModal
            title="Delete Puzzle Database"
            description="Are you sure you want to delete this puzzle database?"
            opened={deleteModalOpened}
            onClose={() => setDeleteModalOpened(false)}
            onConfirm={() => {
              if (selectedDb) {
                commands.deletePuzzleDatabase(selectedDb).then(() => {
                  setPuzzleDbs((dbs) =>
                    dbs.filter((db) => db.path !== selectedDb),
                  );
                  setSelectedDb(null);
                  setPuzzles([]);
                  reset();
                  setTimerStart(null);
                });
              }
              setDeleteModalOpened(false);
            }}
          />
          <Group justify="space-between" pb="sm">
            <Select
              style={{ flex: 1 }}
              data={puzzleDbs
                .map((p) => ({
                  label: p.title.split(".db3")[0],
                  value: p.path,
                }))
                .concat({ label: `+ ${t("Common.AddNew")}`, value: "add" })}
              value={selectedDb}
              clearable={false}
              placeholder={t("Puzzle.SelectDatabase")}
              onChange={(v) => {
                if (v === "add") {
                  setAddOpened(true);
                } else {
                  setSelectedDb(v);
                }
              }}
            />
            <Group gap="xs">
              <Tooltip label="Delete database">
                <ActionIcon
                  color="red"
                  disabled={!selectedDb}
                  onClick={() => setDeleteModalOpened(true)}
                >
                  <IconTrash size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("SideBar.Settings")}>
                <ActionIcon onClick={() => setSettingsOpened((o) => !o)}>
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          <Accordion
            value={settingsOpened ? "settings" : null}
            onChange={(v) => setSettingsOpened(v === "settings")}
            mb="sm"
          >
            <Accordion.Item value="settings">
              <Accordion.Panel>
                <Stack gap="md">
                  {themesTableMissing && (
                    <Alert
                      icon={<IconAlertTriangle />}
                      title="Puzzle database outdated"
                      color="yellow"
                    >
                      This database does not support themes. Update to the
                      latest puzzle DB.
                    </Alert>
                  )}
                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      {t("Puzzle.RatingRange")}
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
                  <Select
                    label="Theme"
                    placeholder="All themes"
                    data={availableThemes.map((theme) => ({
                      label: formatThemeLabel(theme),
                      value: theme,
                    }))}
                    value={selectedTheme}
                    onChange={setSelectedTheme}
                    clearable
                    searchable
                  />
                  <SimpleGrid cols={2} spacing="sm">
                    <Switch
                      label={t("Puzzle.Progressive")}
                      description={t("Puzzle.Progressive.Desc")}
                      checked={progressive}
                      onChange={(event) =>
                        setProgressive(event.currentTarget.checked)
                      }
                    />
                    <Switch
                      label={t("Puzzle.HideRating")}
                      description={t("Puzzle.HideRating.Desc")}
                      checked={hideRating}
                      onChange={(event) =>
                        setHideRating(event.currentTarget.checked)
                      }
                    />
                    <Switch
                      label={t("Puzzle.JumpToNextPuzzleImmediately")}
                      description={t("Puzzle.JumpToNextPuzzleImmediately.Desc")}
                      checked={jumpToNextPuzzleImmediately}
                      onChange={(event) =>
                        setJumpToNextPuzzleImmediately(
                          event.currentTarget.checked,
                        )
                      }
                    />
                    <Switch
                      label={t("Puzzle.TrackPuzzleTime")}
                      description={t("Puzzle.TrackPuzzleTime.Desc")}
                      checked={trackTime}
                      onChange={(event) => {
                          if (!event.currentTarget.checked) {
                            setTimerStart(null);
                            setTrackTime(false);
                          } else {
                            setTrackTime(true);
                          }
                        }
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
                {t("Puzzle.Rating")}
              </Text>
              <Text fw={700} size="lg">
                {(isPuzzleIncomplete && hideRating && puzzles[currentPuzzle]?.rating)
                  ? "?"
                  : (puzzles[currentPuzzle]?.rating || "-")}
              </Text>
            </Paper>

            {trackTime && (<Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Time")}
              </Text>
              <Text fw={700} size="lg" ff="monospace">
                {formatTime(elapsedTime)}
              </Text>
            </Paper>)}

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Accuracy")}
              </Text>
              <Text fw={700} size="lg" c={accuracy === null ? "dimmed" : accuracy >= 50 ? "teal" : "orange"}>
                {accuracy !== null ? `${accuracy}%` : "-"}
              </Text>
            </Paper>

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Streak")}
              </Text>
              <Group gap={2}>
                <Text fw={700} size="lg">
                  {currentStreak}
                </Text>
                <IconFlame size={20} color="orange" />
              </Group>
            </Paper>

            {trackTime && avgTimeSeconds > 0 && (
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  {t("Puzzle.AvgTime")}
                </Text>
                <Text fw={700} size="lg">
                  {avgTimeSeconds.toFixed(1)}s
                </Text>
              </Paper>
            )}
          </Group>
          <Divider my="sm" />
          {!isPuzzleIncomplete &&
            (puzzles[currentPuzzle]?.themes?.length ?? 0) > 0 && (
              <Group gap="xs" mb="sm">
                {puzzles[currentPuzzle]?.themes?.map((theme) => (
                  <Badge key={theme} variant="light" size="sm">
                    {formatThemeLabel(theme)}
                  </Badge>
                ))}
              </Group>
            )}
          <Group justify="space-between">
            <Text fz="1.75rem" fw={500}>
              {!turnToMove
                ? ""
                : turnToMove === "white"
                  ? t("Fen.BlackToMove")
                  : t("Fen.WhiteToMove")}
            </Text>
            <Group gap="xs">
              <Tooltip label={t("Puzzle.NewPuzzle")}>
                <ActionIcon
                  disabled={!selectedDb}
                  onClick={() => generatePuzzle(selectedDb!)}
                >
                  <IconPlus />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("Puzzle.AnalyzePosition")}>
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
              <Tooltip label={t("Puzzle.ClearSession")}>
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
              solutionAbortRef.current?.abort();
              const abortController = new AbortController();
              solutionAbortRef.current = abortController;

              const curPuzzle = puzzles[currentPuzzle];
              if (curPuzzle.completion === "incomplete") {
                changeCompletion("incorrect");
              }
              goToStart();
              for (let i = 0; i < curPuzzle.moves.length; i++) {
                if (abortController.signal.aborted) break;
                makeMove({
                  payload: parseUci(curPuzzle.moves[i])!,
                  mainline: true,
                });
                await new Promise((r) => setTimeout(r, 500));
              }
            }}
            disabled={puzzles.length === 0}
          >
            {t("Puzzle.ViewSolution")}
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
                  label: p.rating?.toString() ?? "-",
                }))}
                current={currentPuzzle}
                select={(i) => {
                  if (i === currentPuzzle) return;
                  solutionAbortRef.current?.abort();
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
