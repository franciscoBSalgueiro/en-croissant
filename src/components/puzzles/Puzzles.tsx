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
import {
  IconAlertTriangle,
  IconBookmarks,
  IconFlame,
  IconPlus,
  IconSettings,
  IconTrash,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import { isNormal, makeSquare, makeUci, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { useAtom, useSetAtom } from "jotai";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  commands,
  type PuzzleDatabaseInfo,
  type SavedPuzzleSession,
} from "@/bindings";
import {
  activeTabAtom,
  currentPuzzleTimerAtom,
  hidePuzzleRatingAtom,
  jumpToNextPuzzleAtom,
  progressivePuzzlesAtom,
  puzzleRatingRangeAtom,
  puzzleSessionIndexAtom,
  puzzleSessionListAtom,
  puzzleThemeAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
  trackPuzzleTimeAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { formatThemeLabel, formatTime } from "@/utils/format";
import {
  type Completion,
  fromSessionPuzzle,
  getPuzzleDatabases,
  type Puzzle,
  toSessionPuzzle,
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
import PuzzleSessionsModal from "./PuzzleSessionsModal";

/** ID used for the automatic save slot. Never shown as a named session. */
const AUTO_SAVE_SESSION_ID = "__autosave__";

function Puzzles({ id }: { id: string }) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const setFen = useStore(store, (s) => s.setFen);
  const goToStart = useStore(store, (s) => s.goToStart);
  const reset = useStore(store, (s) => s.reset);
  const makeMove = useStore(store, (s) => s.makeMove);
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const position = useStore(store, (s) => s.position);
  const setShapes = useStore(store, (s) => s.setShapes);
  const currentMove = useStore(store, (s) => s.currentNode().move);
  const [puzzles, setPuzzles] = useAtom(puzzleSessionListAtom);
  const [currentPuzzle, setCurrentPuzzle] = useAtom(puzzleSessionIndexAtom);

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
  const effectiveSelectedTheme =
    selectedTheme && availableThemes.includes(selectedTheme)
      ? selectedTheme
      : null;

  useEffect(() => {
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
  }, [selectedDb]);

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
      ? wonPuzzles.reduce((acc, p) => acc + (p.timeSpent || 0), 0) /
        wonPuzzles.length /
        1000
      : 0;

  const [isPlayingSolution, setIsPlayingSolution] = useState(false);
  const [progressive, setProgressive] = useAtom(progressivePuzzlesAtom);
  const [trackTime, setTrackTime] = useAtom(trackPuzzleTimeAtom);
  const [timerStart, setTimerStart] = useAtom(currentPuzzleTimerAtom);

  // Reset the board to the very start of a puzzle (after the first forced move).
  // Used when loading a brand-new puzzle for the first time.
  const setPuzzle = useCallback(
    (puzzle: { fen: string; moves: string[] }) => {
      setFen(puzzle.fen);
      makeMove({ payload: parseUci(puzzle.moves[0])! });
    },
    [setFen, makeMove],
  );

  // Navigate to an existing puzzle, restoring the board to the depth the user
  // reached last time.  Falls back to depth 1 (the forced first move) for
  // puzzles that have never been visited this session.
  const navigateToPuzzle = useCallback(
    (puzzleIndex: number, puzzle: { fen: string; moves: string[] }) => {
      const depth = puzzleDepthRef.current.get(puzzleIndex) ?? 1;
      setFen(puzzle.fen);
      makeMoves({
        payload: puzzle.moves.slice(0, depth),
        mainline: true,
        changeHeaders: false,
      });
    },
    [setFen, makeMoves],
  );

  const solutionAbortRef = useRef<AbortController | null>(null);
  // Tracks the current autosave entry so persistSessions can include it without
  // a backend round-trip every time named sessions are written.
  const autosaveRef = useRef<SavedPuzzleSession | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remembers how many moves were played (tree depth) for each puzzle index so
  // that navigating back restores the board to where the user left off.
  const puzzleDepthRef = useRef<Map<number, number>>(new Map());

  // On mount: restore the board from the localStorage-persisted session, or
  // auto-load the last autosave from the backend when no local session exists.
  // Named sessions (excluding the autosave slot) are loaded into savedSessions.
  useEffect(() => {
    commands.getPuzzleSessions().then((res) => {
      if (res.status === "ok") {
        const autosave = res.data.find((s) => s.id === AUTO_SAVE_SESSION_ID);

        if (autosave) {
          autosaveRef.current = autosave;
        }

        // Exclude the autosave slot from the user-visible named sessions list
        setSavedSessions(res.data.filter((s) => s.id !== AUTO_SAVE_SESSION_ID));

        if (puzzles.length > 0) {
          // Active session already in localStorage; just restore the board
          const puzzle = puzzles[currentPuzzle];

          if (puzzle) {
            setPuzzle(puzzle);
          }
        } else if (autosave && autosave.puzzles.length > 0) {
          // No local session found; auto-load the last autosave
          const puzzleList = autosave.puzzles.map(fromSessionPuzzle);

          setPuzzles(puzzleList);

          const safeIndex = Math.min(
            autosave.currentPuzzle,
            puzzleList.length - 1,
          );

          setCurrentPuzzle(safeIndex);

          const restoredPuzzle = puzzleList[safeIndex];

          if (restoredPuzzle) {
            setPuzzle(restoredPuzzle);
          }

          if (autosave.dbPath) {
            setSelectedDb(autosave.dbPath);
          }
        }
      }

      setSessionsChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generatePuzzle(db: string, force: boolean = false) {
    let nextIndex = puzzles.findIndex(
      (p, i) => i > currentPuzzle && p.completion === "incomplete",
    );

    if (nextIndex === -1) {
      nextIndex = puzzles.findIndex(
        (p, i) => i < currentPuzzle && p.completion === "incomplete",
      );
    }

    if (nextIndex !== -1 && !force) {
      puzzleDepthRef.current.set(currentPuzzle, position.length);
      solutionAbortRef.current?.abort();
      setIsPlayingSolution(false);
      setCurrentPuzzle(nextIndex);
      navigateToPuzzle(nextIndex, puzzles[nextIndex]);
      if (trackTime) {
        setTimerStart(Date.now() - (puzzles[nextIndex].timeSpent || 0));
      }
      return;
    }

    puzzleDepthRef.current.set(currentPuzzle, position.length);
    solutionAbortRef.current?.abort();
    setIsPlayingSolution(false);

    let range = ratingRange;
    if (progressive) {
      const rating = puzzles[currentPuzzle]?.rating;
      if (rating) {
        range = [rating + 50, rating + 100];
        setRatingRange([rating + 50, rating + 100]);
      }
    }

    const res = await commands.getPuzzle(
      db,
      range[0],
      range[1],
      effectiveSelectedTheme,
    );

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
    if (trackTime) {
      setTimerStart(Date.now());
    }
  }

  async function changeCompletion(completion: Completion) {
    const timeSpent = timerStart !== null ? Date.now() - timerStart : 0;
    const puzzle = puzzles[currentPuzzle];
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      puzzles[currentPuzzle].timeSpent = timeSpent;
      return [...puzzles];
    });
    setTimerStart(null);

    if (selectedDb && puzzle?.id) {
      const res = await commands.getThemesForPuzzle(selectedDb, puzzle.id);
      if (res.status === "ok") {
        setPuzzles((puzzles) => {
          puzzles[currentPuzzle].themes = res.data;
          return [...puzzles];
        });
      }
    }
  }

  const [addOpened, setAddOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [sessionsOpened, setSessionsOpened] = useState(false);
  const [hideRating, setHideRating] = useAtom(hidePuzzleRatingAtom);
  const [savedSessions, setSavedSessions] = useState<SavedPuzzleSession[]>([]);
  // Blocks the timer-start effect until the init load is complete
  const [sessionsChecked, setSessionsChecked] = useState(false);

  function persistSessions(updated: SavedPuzzleSession[]) {
    setSavedSessions(updated);
    // Always keep the autosave slot alongside named sessions so it is not lost
    // when the user saves, renames, or deletes a named session.
    const allSessions = autosaveRef.current
      ? [autosaveRef.current, ...updated]
      : updated;
    commands.setPuzzleSessions(allSessions);
  }

  function saveSession() {
    const name = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const newSession: SavedPuzzleSession = {
      id: crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      puzzles: puzzles.map(toSessionPuzzle),
      currentPuzzle,
      dbPath: selectedDb,
    };
    persistSessions([newSession, ...savedSessions]);
  }

  function resumeSession(session: SavedPuzzleSession) {
    solutionAbortRef.current?.abort();
    setIsPlayingSolution(false);
    puzzleDepthRef.current.clear();
    const puzzleList = session.puzzles.map(fromSessionPuzzle);
    setPuzzles(puzzleList);
    setCurrentPuzzle(session.currentPuzzle);
    const puzzle = puzzleList[session.currentPuzzle];
    if (puzzle) {
      setPuzzle(puzzle);
      if (trackTime && puzzle.completion === "incomplete") {
        setTimerStart(Date.now() - (puzzle.timeSpent || 0));
      } else {
        setTimerStart(null);
      }
    }
    if (session.dbPath) {
      setSelectedDb(session.dbPath);
    }
    setSessionsOpened(false);
  }

  function renameSession(sessionId: string, newName: string) {
    persistSessions(
      savedSessions.map((s) =>
        s.id === sessionId ? { ...s, name: newName } : s,
      ),
    );
  }

  function overwriteSession(sessionId: string) {
    persistSessions(
      savedSessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              savedAt: Date.now(),
              puzzles: puzzles.map(toSessionPuzzle),
              currentPuzzle,
              dbPath: selectedDb,
            }
          : s,
      ),
    );
  }

  function deleteSession(sessionId: string) {
    persistSessions(savedSessions.filter((s) => s.id !== sessionId));
  }

  // Auto-save the current session to the backend whenever it changes.
  // Uses a debounce to avoid excessive I/O on rapid state changes.
  useEffect(() => {
    if (!sessionsChecked) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    if (puzzles.length === 0) {
      // Session was cleared; remove the autosave slot from the backend
      if (autosaveRef.current) {
        autosaveRef.current = null;
        commands.setPuzzleSessions(savedSessions);
      }
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const autosave: SavedPuzzleSession = {
        id: AUTO_SAVE_SESSION_ID,
        name: "Autosave",
        savedAt: Date.now(),
        puzzles: puzzles.map(toSessionPuzzle),
        currentPuzzle,
        dbPath: selectedDb,
      };
      autosaveRef.current = autosave;
      commands.setPuzzleSessions([autosave, ...savedSessions]);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [puzzles, currentPuzzle, selectedDb, sessionsChecked, savedSessions]);

  const [, setTick] = useState(0);
  const isPuzzleIncomplete =
    puzzles[currentPuzzle]?.completion === "incomplete";
  const elapsedTime =
    timerStart && isPuzzleIncomplete && trackTime
      ? Date.now() - timerStart
      : puzzles[currentPuzzle]?.timeSpent || 0;

  useEffect(() => {
    if (
      !sessionsChecked ||
      !trackTime ||
      !isPuzzleIncomplete ||
      timerStart !== null
    )
      return;
    setTimerStart(Date.now() - (puzzles[currentPuzzle]?.timeSpent || 0));
  }, [
    sessionsChecked,
    trackTime,
    isPuzzleIncomplete,
    timerStart,
    setTimerStart,
    puzzles,
    currentPuzzle,
  ]);

  useEffect(() => {
    if (!trackTime || !isPuzzleIncomplete || timerStart === null) return;

    const displayInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(displayInterval);
  }, [trackTime, isPuzzleIncomplete, timerStart]);

  useEffect(() => {
    return () => {
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

  const currentlyOnLastMoveOrNoLastMove = (): boolean => {
    if (!currentMove) return true;

    const moves = puzzles[currentPuzzle]?.moves;
    if (!moves) return true;

    const lastMoveIndex = moves.indexOf(makeUci(currentMove));
    return lastMoveIndex + 1 === moves.length;
  };

  const nextMoveUci = () => {
    const curPuzzle = puzzles[currentPuzzle];
    if (!curPuzzle || !currentMove) return;

    const indexOfNextMoveToPlay =
      curPuzzle.moves.indexOf(makeUci(currentMove)) + 1;
    const nextMoveUci = curPuzzle.moves[indexOfNextMoveToPlay];
    if (!nextMoveUci) return;

    const nextMove = parseUci(nextMoveUci);
    if (!nextMove || !isNormal(nextMove)) return;

    return nextMove;
  };

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
          <PuzzleSessionsModal
            opened={sessionsOpened}
            onClose={() => setSessionsOpened(false)}
            sessions={savedSessions}
            currentPuzzles={puzzles}
            currentIndex={currentPuzzle}
            currentDb={selectedDb}
            onSave={saveSession}
            onResume={resumeSession}
            onOverwrite={overwriteSession}
            onRename={renameSession}
            onDelete={deleteSession}
          />
          <ConfirmModal
            title="Delete Puzzle Database"
            description="Are you sure you want to delete this puzzle database?"
            opened={deleteModalOpened}
            onClose={() => setDeleteModalOpened(false)}
            onConfirm={async () => {
              if (selectedDb) {
                await commands.deletePuzzleDatabase(selectedDb);
                setPuzzleDbs((dbs) =>
                  dbs.filter((db) => db.path !== selectedDb),
                );
                setSelectedDb(null);
                setPuzzles([]);
                setCurrentPuzzle(0);
                reset();
                setTimerStart(null);
                setIsPlayingSolution(false);
                puzzleDepthRef.current.clear();
                autosaveRef.current = null;
                commands.setPuzzleSessions(savedSessions);
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
              <Tooltip label={t("Puzzle.SavedSessions", "Saved sessions")}>
                <ActionIcon
                  onClick={() => setSessionsOpened(true)}
                  variant={savedSessions.length > 0 ? "light" : "subtle"}
                  color={savedSessions.length > 0 ? "blue" : undefined}
                >
                  <IconBookmarks size={20} />
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
                    value={effectiveSelectedTheme}
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
                      }}
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
                {isPuzzleIncomplete &&
                hideRating &&
                puzzles[currentPuzzle]?.rating
                  ? "?"
                  : puzzles[currentPuzzle]?.rating || "-"}
              </Text>
            </Paper>

            {trackTime && (
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  {t("Puzzle.Time")}
                </Text>
                <Text fw={700} size="lg" ff="monospace">
                  {formatTime(elapsedTime)}
                </Text>
              </Paper>
            )}

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Accuracy")}
              </Text>
              <Text
                fw={700}
                size="lg"
                c={
                  accuracy === null
                    ? "dimmed"
                    : accuracy >= 50
                      ? "teal"
                      : "orange"
                }
              >
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
                  onClick={() => generatePuzzle(selectedDb!, true)}
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
                    setCurrentPuzzle(0);
                    reset();
                    setTimerStart(null);
                    setIsPlayingSolution(false);
                    puzzleDepthRef.current.clear();
                    // Remove the autosave so the cleared session is not
                    // reloaded on the next startup
                    autosaveRef.current = null;
                    commands.setPuzzleSessions(savedSessions);
                  }}
                >
                  <IconX />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          <Group grow>
            <Button
              mt="sm"
              variant="light"
              fullWidth
              onClick={async () => {
                solutionAbortRef.current?.abort();
                setIsPlayingSolution(false);
                const abortController = new AbortController();
                solutionAbortRef.current = abortController;
                const curPuzzle = puzzles[currentPuzzle];

                if (curPuzzle.completion === "incomplete") {
                  changeCompletion("incorrect");
                }

                if (currentlyOnLastMoveOrNoLastMove()) return;

                const nextMove = nextMoveUci();
                if (!nextMove) return;

                const from = makeSquare(nextMove.from);
                const to = makeSquare(nextMove.to);
                const currentShapes = store.getState().currentNode().shapes;

                // Progressive hints: circle > arrow > clear
                const hasCircle = currentShapes.some(
                  (s) => s.orig === from && !s.dest,
                );
                const hasArrow = currentShapes.some(
                  (s) => s.orig === from && s.dest === to,
                );

                if (hasArrow) {
                  // Third click: Remove all hint shapes for this move
                  setShapes(
                    currentShapes.filter(
                      (s) => !(s.orig === from && (!s.dest || s.dest === to)),
                    ),
                  );
                } else if (hasCircle) {
                  // Second click: Replace circle with arrow
                  setShapes([
                    ...currentShapes.filter(
                      (s) => !(s.orig === from && !s.dest),
                    ),
                    { orig: from, dest: to, brush: "green" },
                  ]);
                } else {
                  // First click: Add circle
                  setShapes([
                    ...currentShapes,
                    { orig: from, dest: undefined, brush: "green" },
                  ]);
                }
              }}
              disabled={
                puzzles.length === 0 ||
                currentlyOnLastMoveOrNoLastMove() ||
                isPlayingSolution
              }
            >
              {t("Puzzle.GetAHint")}
            </Button>
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
                setIsPlayingSolution(true);
                goToStart();
                for (let i = 0; i < curPuzzle.moves.length; i++) {
                  if (abortController.signal.aborted) break;
                  makeMove({
                    payload: parseUci(curPuzzle.moves[i])!,
                    mainline: true,
                  });
                  await new Promise((r) => setTimeout(r, 500));
                }
                setIsPlayingSolution(false);
              }}
              disabled={puzzles.length === 0}
            >
              {t("Puzzle.ViewSolution")}
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
                  label: p.rating?.toString() ?? "-",
                }))}
                current={currentPuzzle}
                select={(i) => {
                  if (i === currentPuzzle) return;
                  // Save where the user was in the current puzzle before leaving
                  puzzleDepthRef.current.set(currentPuzzle, position.length);
                  solutionAbortRef.current?.abort();
                  setIsPlayingSolution(false);
                  setCurrentPuzzle(i);
                  // Restore the board to the depth last visited for puzzle i
                  navigateToPuzzle(i, puzzles[i]);
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
