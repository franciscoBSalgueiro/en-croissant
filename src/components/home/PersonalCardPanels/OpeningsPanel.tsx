import { Button, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useAtom, useStore } from "jotai";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { INITIAL_FEN } from "chessops/fen";
import type { StatsData } from "@/bindings";
import type { PlayerGameInfo } from "@/bindings";
import {
  activeTabAtom,
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLocalOptionsAtom,
  referenceDbAtom,
  tabFamily,
  tabsAtom,
} from "@/state/atoms";
import { createTab } from "@/utils/tabs";

export interface OpeningSource {
  file: string;
  player: string;
}

type ColorStats = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
};

function buildColorStats(games: StatsData[]) {
  const stats: Record<"white" | "black", ColorStats> = {
    white: { games: 0, wins: 0, draws: 0, losses: 0 },
    black: { games: 0, wins: 0, draws: 0, losses: 0 },
  };

  for (const game of games) {
    const color: "white" | "black" = game.is_player_white ? "white" : "black";
    const bucket = stats[color];
    bucket.games += 1;

    if (game.result === "Won") bucket.wins += 1;
    else if (game.result === "Drawn") bucket.draws += 1;
    else bucket.losses += 1;
  }

  return stats;
}

function ratio(numerator: number, denominator: number) {
  if (denominator === 0) return "0.0";
  return ((numerator / denominator) * 100).toFixed(1);
}

function ColorCard({
  color,
  stats,
  onOpen,
}: {
  color: "white" | "black";
  stats: ColorStats;
  onOpen: () => Promise<void>;
}) {
  const title = color === "white" ? "As White" : "As Black";

  return (
    <Paper withBorder p="md" h="100%">
      <Stack gap={6}>
        <Text fw={700}>{title}</Text>
        <Text size="sm" c="dimmed">
          {stats.games} games
        </Text>
        <Text size="sm">Win rate: {ratio(stats.wins, stats.games)}%</Text>
        <Text size="sm">Draw rate: {ratio(stats.draws, stats.games)}%</Text>
        <Text size="sm">Loss rate: {ratio(stats.losses, stats.games)}%</Text>
        <Button mt="sm" variant="light" onClick={() => onOpen()}>
          Open in Tabs
        </Button>
      </Stack>
    </Paper>
  );
}

function OpeningsPanel({
  playerName,
  info,
  openingSources,
}: {
  playerName: string;
  info: PlayerGameInfo;
  openingSources?: OpeningSource[];
}) {
  const navigate = useNavigate();
  const store = useStore();
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const sources = openingSources ?? [];

  const games = useMemo(
    () => info.site_stats_data.flatMap((site) => site.data),
    [info.site_stats_data],
  );
  const colorStats = useMemo(() => buildColorStats(games), [games]);

  const openDatabaseInTabs = async (color: "white" | "black") => {
    const preferredDb =
      sources.find((source) => source.player === playerName)?.file ||
      sources[0]?.file ||
      referenceDatabase;

    if (preferredDb) {
      setReferenceDatabase(preferredDb);
    }

    const tabId = await createTab({
      tab: {
        name: `${playerName} ${color === "white" ? "White" : "Black"} Database`,
        type: "analysis",
      },
      setTabs,
      setActiveTab,
    });

    // Configure the new tab before navigating so the database panel is ready immediately.
    store.set(activeTabAtom, tabId);
    store.set(tabFamily(tabId), "database");
    store.set(currentDbTypeAtom, "local");
    store.set(currentDbTabAtom, "stats");
    store.set(currentLocalOptionsAtom, (prev) => ({
      ...prev,
      path: preferredDb ?? prev.path,
      fen: prev.fen || INITIAL_FEN,
      player: playerName,
      color,
      result: "any",
    }));

    void navigate({ to: "/" });
  };

  const total = colorStats.white.games + colorStats.black.games;
  const totalWins = colorStats.white.wins + colorStats.black.wins;
  const totalDraws = colorStats.white.draws + colorStats.black.draws;
  const totalLosses = colorStats.white.losses + colorStats.black.losses;

  return (
    <Stack gap="md" pt="md" h="100%">
      <Paper withBorder p="md">
        <Group justify="space-between" wrap="wrap">
          <Text fw={700}>Overall</Text>
          <Text c="dimmed" size="sm">
            {total} games
          </Text>
        </Group>
        <Group gap="lg" mt="xs" wrap="wrap">
          <Text size="sm">Wins: {ratio(totalWins, total)}%</Text>
          <Text size="sm">Draws: {ratio(totalDraws, total)}%</Text>
          <Text size="sm">Losses: {ratio(totalLosses, total)}%</Text>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <ColorCard
          color="white"
          stats={colorStats.white}
          onOpen={() => openDatabaseInTabs("white")}
        />
        <ColorCard
          color="black"
          stats={colorStats.black}
          onOpen={() => openDatabaseInTabs("black")}
        />
      </SimpleGrid>

      {sources.length === 0 && (
        <Text c="dimmed" size="sm">
          No personal database source was detected. The button will still open the database panel,
          but you may need to select a database manually.
        </Text>
      )}
    </Stack>
  );
}

export default OpeningsPanel;
