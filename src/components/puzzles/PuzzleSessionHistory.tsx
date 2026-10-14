import {
  Accordion,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { puzzleSessionsAtom } from "@/state/puzzleSessions";
import { formatTime } from "@/utils/format";
import type { Puzzle } from "@/utils/puzzles";
import {
  groupPuzzleSessionsByDay,
  puzzleSessionDay,
  puzzleSessionStats,
  type PuzzleSession,
} from "@/utils/puzzleSessions";

export default function PuzzleSessionHistory({
  onInspect,
}: {
  onInspect: (puzzle: Puzzle) => void;
}) {
  const { t, i18n } = useTranslation();
  const sessions = useAtomValue(puzzleSessionsAtom);
  const [today, setToday] = useState(() => puzzleSessionDay(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(puzzleSessionDay(Date.now())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const groups = groupPuzzleSessionsByDay(sessions);
  const currentDay = groups.find((group) => group.day === today);
  const previousDays = groups.filter((group) => group.day !== today);
  const date = (timestamp: number) =>
    new Date(timestamp).toLocaleString(i18n.resolvedLanguage, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const renderSession = (session: PuzzleSession) => {
    const stats = puzzleSessionStats(session.puzzles);
    const database = session.database
      ?.split(/[\\/]/)
      .pop()
      ?.replace(/\.db3$/, "");
    return (
      <Accordion.Item key={session.id} value={session.id}>
        <Accordion.Control>
          <Stack gap={4}>
            <Text fw={600}>{date(session.startedAt)}</Text>
            {database && (
              <Text size="sm" c="dimmed">
                {database}
              </Text>
            )}
            <Group gap="md">
              <Text size="sm">{t("Puzzle.HistoryCompleted", { count: stats.completed })}</Text>
              <Text size="sm">
                {t("Puzzle.Accuracy")}: {stats.accuracy === null ? "—" : `${stats.accuracy}%`}
              </Text>
              <Text size="sm">
                {t("Puzzle.Time")}: {formatTime(stats.timeSpent)}
              </Text>
            </Group>
          </Stack>
        </Accordion.Control>
        <Accordion.Panel>
          <Text size="xs" c="dimmed" mb="sm">
            {t("Puzzle.HistoryLastActivity")}: {date(session.updatedAt)}
          </Text>
          <Table.ScrollContainer minWidth={460}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>{t("Puzzle.Rating")}</Table.Th>
                  <Table.Th>{t("Puzzle.HistoryResult")}</Table.Th>
                  <Table.Th>{t("Puzzle.Time")}</Table.Th>
                  <Table.Th>{t("Puzzle.AnalyzePosition")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {session.puzzles.map((puzzle, index) => (
                  <Table.Tr key={`${puzzle.id}-${index}`}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{puzzle.rating}</Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c={
                          puzzle.completion === "correct"
                            ? "teal"
                            : puzzle.completion === "incorrect"
                              ? "red"
                              : "dimmed"
                        }
                      >
                        {puzzle.completion === "correct"
                          ? t("Puzzle.HistoryCorrect")
                          : puzzle.completion === "incorrect"
                            ? t("Puzzle.HistoryIncorrect")
                            : t("Puzzle.HistoryIncomplete")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {puzzle.timeSpent === undefined ? "—" : formatTime(puzzle.timeSpent)}
                    </Table.Td>
                    <Table.Td>
                      <Button variant="subtle" size="compact-xs" onClick={() => onInspect(puzzle)}>
                        {t("Puzzle.AnalyzePosition")}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Accordion.Panel>
      </Accordion.Item>
    );
  };
  return (
    <Paper
      withBorder
      p="sm"
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Text fw={600} mb="xs" style={{ flexShrink: 0 }}>
        {t("Puzzle.SessionHistory")}
      </Text>
      <ScrollArea flex={1} style={{ minHeight: 0 }} scrollbars="y" offsetScrollbars>
        <Text size="xs" c="dimmed" mb="sm">
          {t("Puzzle.HistorySavedLocally")}
        </Text>
        {sessions.length === 0 ? (
          <Text c="dimmed">{t("Puzzle.NoSavedSessions")}</Text>
        ) : (
          <Stack gap="sm">
            {currentDay && (
              <div>
                <Text fw={600} size="sm" mb="xs">
                  {t("Puzzle.HistoryToday")}
                </Text>
                <Accordion multiple>{currentDay.sessions.map(renderSession)}</Accordion>
              </div>
            )}
            <Accordion multiple>
              {previousDays.map((group) => (
                <Accordion.Item key={group.day} value={group.day}>
                  <Accordion.Control>
                    <Group gap="xs">
                      <Text fw={600}>
                        {new Date(group.timestamp).toLocaleDateString(i18n.resolvedLanguage, {
                          dateStyle: "medium",
                        })}
                      </Text>
                      <Badge variant="light">{group.sessions.length}</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Accordion multiple>{group.sessions.map(renderSession)}</Accordion>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        )}
      </ScrollArea>
    </Paper>
  );
}
