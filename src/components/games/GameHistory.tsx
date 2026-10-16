import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAtom, useSetAtom } from "jotai";
import { useState } from "react";
import useSWR from "swr";
import { activeTabAtom, tabsAtom, restoreGameSessionAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { genID } from "@/utils/tabs";
import {
  savedGamePgn,
  savedGamePlayers,
  savedGameResult,
  type SavedGame,
  type SavedGameSummary,
} from "@/utils/savedGames";

export default function GameHistory({ recent = false }: { recent?: boolean }) {
  const {
    data: games = [],
    error: loadError,
    isLoading: loading,
    isValidating: refreshing,
    mutate: refresh,
  } = useSWR("saved-game-history", () => invoke<SavedGameSummary[]>("list_saved_games"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tabs, setTabs] = useAtom(tabsAtom);
  const setActive = useSetAtom(activeTabAtom);
  const setRecovery = useSetAtom(restoreGameSessionAtom);
  const navigate = useNavigate();
  const visibleError = error || (loadError ? String(loadError) : "");
  const open = async (game: SavedGameSummary, resume: boolean) => {
    setBusy(true);
    setError("");
    try {
      const record = await invoke<SavedGame>("load_saved_game", { id: game.id });
      const tree = await parsePGN(savedGamePgn(record));
      tree.position = Array(record.state.moves.length).fill(0);
      const existing =
        resume && game.activeGameId
          ? tabs.find((tab) => `${tab.value}-game` === game.activeGameId)
          : undefined;
      const id =
        existing?.value ??
        (resume && game.activeGameId ? game.activeGameId.replace(/-game$/, "") : genID());
      if (resume) {
        if (!game.activeGameId)
          await invoke("resume_saved_game", { id: game.id, gameId: `${id}-game` });
        setRecovery({
          tabId: id,
          gameId: game.activeGameId ?? `${id}-game`,
          players: savedGamePlayers(record.config),
        });
      }
      if (!existing) sessionStorage.setItem(id, JSON.stringify({ version: 0, state: tree }));
      setTabs((values) =>
        existing
          ? values.map((tab) => (tab.value === id ? { ...tab, type: "play" } : tab))
          : [
              ...values,
              {
                value: id,
                name: `${record.state.whitePlayer} vs. ${record.state.blackPlayer}`,
                type: resume ? "play" : "analysis",
                gameOrigin: { kind: "none" },
              },
            ],
      );
      setActive(id);
      await navigate({ to: "/" });
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const exportGame = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const record = await invoke<SavedGame>("load_saved_game", { id });
      const path = await save({
        defaultPath: `game-${id}.pgn`,
        filters: [{ name: "PGN", extensions: ["pgn"] }],
      });
      if (path) await writeTextFile(path, savedGamePgn(record));
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  if (recent) {
    const recentGames = [...games]
      .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
      .slice(0, 5);
    return (
      <Card shadow="sm" p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Recent Games
            </Text>
            <Button size="xs" variant="subtle" onClick={() => void navigate({ to: "/games" })}>
              View all
            </Button>
          </Group>
          {visibleError && (
            <Alert color="red" title="Could not access saved games">
              {visibleError}
            </Alert>
          )}
          {loading ? (
            <Loader size="sm" aria-label="Loading recent games" />
          ) : recentGames.length === 0 ? (
            <Text size="sm" c="dimmed">
              {visibleError
                ? "Your saved games could not be loaded."
                : "No saved games yet. Play a game to see it here."}
            </Text>
          ) : (
            recentGames.map((game) => (
              <Group key={game.id} justify="space-between" gap="sm">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={500} truncate>
                    {game.white} vs. {game.black}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(Number(game.updatedAt)).toLocaleString()} · {Math.ceil(game.ply / 2)}{" "}
                    moves
                  </Text>
                </Stack>
                <Badge color={game.status === "playing" ? "yellow" : "green"}>
                  {game.status === "playing"
                    ? game.activeGameId
                      ? "In progress"
                      : "Interrupted"
                    : savedGameResult(game.status)}
                </Badge>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="default"
                    disabled={busy}
                    onClick={() => void open(game, false)}
                  >
                    Analyze
                  </Button>
                  {game.status === "playing" && (
                    <Button size="xs" disabled={busy} onClick={() => void open(game, true)}>
                      {game.activeGameId ? "Return to game" : "Resume"}
                    </Button>
                  )}
                </Group>
              </Group>
            ))
          )}
        </Stack>
      </Card>
    );
  }
  return (
    <Stack p="md" h="100%">
      <Group justify="space-between">
        <Title order={2}>Game history</Title>
        <Button
          variant="default"
          disabled={loading || refreshing || busy}
          onClick={() => {
            setError("");
            void refresh().catch((reason) => setError(String(reason)));
          }}
        >
          Refresh
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Games are saved on this device after every move. Recover interrupted games with Resume;
        clocks remain paused while the app is closed.
      </Text>
      {visibleError && (
        <Alert color="red" title="Could not access saved games">
          {visibleError}
        </Alert>
      )}
      {loading ? (
        <Loader aria-label="Loading game history" />
      ) : !games.length ? (
        <Text>
          {visibleError
            ? "Refresh to retry loading your saved games."
            : "No saved games yet. New games are saved automatically when they start."}
        </Text>
      ) : (
        <ScrollArea>
          <Table.ScrollContainer minWidth={700}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Players</Table.Th>
                  <Table.Th>Result</Table.Th>
                  <Table.Th>Moves</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {games.map((game) => (
                  <Table.Tr key={game.id}>
                    <Table.Td>
                      <Text size="sm">{new Date(Number(game.startedAt)).toLocaleString()}</Text>
                      <Text size="xs" c="dimmed">
                        Saved {new Date(Number(game.updatedAt)).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {game.white} vs. {game.black}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={game.status === "playing" ? "yellow" : "green"}>
                        {game.status === "playing"
                          ? game.activeGameId
                            ? "In progress"
                            : "Interrupted"
                          : savedGameResult(game.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{Math.ceil(game.ply / 2)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="default"
                          disabled={busy}
                          onClick={() => void open(game, false)}
                        >
                          Analyze
                        </Button>
                        {game.status === "playing" && (
                          <Button size="xs" disabled={busy} onClick={() => void open(game, true)}>
                            {game.activeGameId ? "Return to game" : "Resume"}
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="subtle"
                          disabled={busy}
                          onClick={() => void exportGame(game.id)}
                        >
                          Export PGN
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </ScrollArea>
      )}
    </Stack>
  );
}
