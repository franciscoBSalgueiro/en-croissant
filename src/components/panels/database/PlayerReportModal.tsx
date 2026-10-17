import {
  Alert,
  Badge,
  Box,
  Group,
  Modal,
  Progress,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import type { NormalizedGame, PlayerOpening } from "@/bindings";
import { formatNumber } from "@/utils/format";
import { playerReport } from "@/utils/playerReport";
import classes from "./OpeningsTable.module.css";

type ResultBarSize = "xs" | "sm" | "md" | "lg" | "xl";

function ResultBar({
  wins,
  draws,
  losses,
  size = "xl",
}: {
  wins: number;
  draws: number;
  losses: number;
  size?: ResultBarSize;
}) {
  const total = wins + draws + losses;
  const winsPercent = total > 0 ? (wins / total) * 100 : 0;
  const drawsPercent = total > 0 ? (draws / total) * 100 : 0;
  const lossesPercent = total > 0 ? (losses / total) * 100 : 0;
  const showLabels = size === "xl";
  return (
    <Progress.Root size={size} className={classes.result}>
      <Progress.Section value={winsPercent} className={classes.whiteResultsSection}>
        <Progress.Label c="black">
          {showLabels && winsPercent > 10 ? `${winsPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={drawsPercent} color="gray">
        <Progress.Label>
          {showLabels && drawsPercent > 10 ? `${drawsPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={lossesPercent} color="black">
        <Progress.Label>
          {showLabels && lossesPercent > 10 ? `${lossesPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
    </Progress.Root>
  );
}

function ResultLegend({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const { t } = useTranslation();
  return (
    <Group gap="md" wrap="wrap">
      <Group gap="xs" wrap="nowrap">
        <Box w={10} h={10} className={`${classes.result} ${classes.whiteResultsSection}`} />
        <Text fz="sm">
          {formatNumber(wins)} {t("Board.PlayerReport.Wins")}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Box w={10} h={10} className={classes.result} bg="gray" />
        <Text fz="sm">
          {formatNumber(draws)} {t("Board.PlayerReport.Draws")}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Box w={10} h={10} className={classes.result} bg="black" />
        <Text fz="sm">
          {formatNumber(losses)} {t("Board.PlayerReport.Losses")}
        </Text>
      </Group>
    </Group>
  );
}

function OpeningsList({ openings }: { openings: PlayerOpening[] }) {
  const { t } = useTranslation();
  if (openings.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        {t("Board.PlayerReport.OpeningsEmpty")}
      </Text>
    );
  }
  return (
    <Table highlightOnHover fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={100}>{t("Board.PlayerReport.ECO")}</Table.Th>
          <Table.Th w={80}>{t("Board.PlayerReport.Games")}</Table.Th>
          <Table.Th w={0} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {openings.map((opening) => (
          <Table.Tr key={opening.eco}>
            <Table.Td fw={500}>{opening.eco}</Table.Td>
            <Table.Td>{formatNumber(opening.games)}</Table.Td>
            <Table.Td w={220}>
              <ResultBar
                wins={opening.wins}
                draws={opening.draws}
                losses={opening.losses}
                size="sm"
              />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function PlayerCell({ name, elo }: { name: string; elo?: number | null }) {
  return (
    <div>
      <Text size="sm" fw={500} style={{ whiteSpace: "nowrap" }}>
        {name}
      </Text>
      <Text size="xs" c="dimmed">
        {elo === 0 ? "Unrated" : elo}
      </Text>
    </div>
  );
}

function resultBadgeProps(game: NormalizedGame, playerId: number) {
  if (game.result === "*" || game.result === "1/2-1/2") {
    return { color: "gray", variant: "light" as const };
  }
  const whiteWon = game.result === "1-0";
  const playerWon = game.white_id === playerId ? whiteWon : !whiteWon;
  return playerWon
    ? { color: "green", variant: "light" as const }
    : { color: "red", variant: "light" as const };
}

function BestGamesList({ games, playerId }: { games: NormalizedGame[]; playerId: number }) {
  const { t } = useTranslation();
  if (games.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        {t("Board.PlayerReport.BestGamesEmpty")}
      </Text>
    );
  }
  return (
    <Stack gap={0}>
      {games.map((game) => (
        <Group
          key={game.id}
          justify="space-between"
          wrap="nowrap"
          gap="sm"
          px="xs"
          py={6}
          style={{
            borderTop: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Box miw={110} style={{ overflow: "hidden" }}>
              <PlayerCell name={game.white} elo={game.white_elo} />
            </Box>
            <Text fz="xs" c="dimmed">
              {t("Board.PlayerReport.Vs")}
            </Text>
            <Box miw={110} style={{ flex: 1, overflow: "hidden" }}>
              <PlayerCell name={game.black} elo={game.black_elo} />
            </Box>
          </Group>
          <Text fz="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {game.date || "—"}
          </Text>
          <Text fz="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {game.eco || "—"}
          </Text>
          <Badge size="sm" {...resultBadgeProps(game, playerId)}>
            {game.result.replaceAll("1/2", "½")}
          </Badge>
        </Group>
      ))}
    </Stack>
  );
}

function PlayerReportModal({
  opened,
  onClose,
  file,
  playerId,
  playerName,
}: {
  opened: boolean;
  onClose: () => void;
  file: string;
  playerId: number;
  playerName: string;
}) {
  const { t } = useTranslation();

  const {
    data: report,
    error,
    isLoading,
  } = useSWR(opened ? ["player-report", file, playerId] : null, () => playerReport(file, playerId));

  const games = report?.games ?? 0;
  const wins = report?.wins ?? 0;
  const draws = report?.draws ?? 0;
  const losses = report?.losses ?? 0;
  const winRate = games > 0 ? (wins / games) * 100 : 0;
  const yearsActive =
    report?.first_year && report?.last_year
      ? report.first_year === report.last_year
        ? report.first_year
        : `${report.first_year}–${report.last_year}`
      : null;
  const openings = [...(report?.openings ?? [])].sort((a, b) => b.games - a.games);

  return (
    <Modal opened={opened} onClose={onClose} title={playerName} size="lg">
      {isLoading ? (
        <Stack gap="sm">
          <Skeleton height="2rem" />
          <Skeleton height="4rem" />
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
        </Stack>
      ) : error ? (
        <Alert icon={<IconAlertCircle size="1rem" />} title={t("Common.Error")} color="red">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      ) : report ? (
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Group gap="xs" wrap="nowrap">
              {report.elo !== null && <Badge size="lg">{report.elo} ELO</Badge>}
              {yearsActive && (
                <Text fz="sm" c="dimmed">
                  {yearsActive}
                </Text>
              )}
            </Group>
            <Text fz="sm" c="dimmed">
              {t("Board.PlayerReport.GamesCount", { games: formatNumber(games) })}
            </Text>
          </Group>

          {games === 0 ? (
            <Text fz="sm" c="dimmed">
              {t("Board.PlayerReport.NoGames")}
            </Text>
          ) : (
            <>
              <Stack gap="xs">
                <ResultLegend wins={wins} draws={draws} losses={losses} />
                <ResultBar wins={wins} draws={draws} losses={losses} />
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fz="sm" c="dimmed">
                      {t("Board.PlayerReport.WinRate")}
                    </Text>
                    <Text fz="sm" fw={500}>
                      {winRate.toFixed(1)}%
                    </Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap">
                    <Text fz="sm" c="dimmed">
                      {t("Board.PlayerReport.AverageOpponentElo")}
                    </Text>
                    <Text fz="sm" fw={500}>
                      {report.avg_opponent_elo === null
                        ? "—"
                        : formatNumber(Math.round(report.avg_opponent_elo))}
                    </Text>
                  </Group>
                </SimpleGrid>
              </Stack>

              <Stack gap="xs">
                <Text fz="sm" fw={600}>
                  {t("Board.PlayerReport.Openings")}
                </Text>
                <OpeningsList openings={openings} />
              </Stack>

              <Stack gap="xs">
                <Text fz="sm" fw={600}>
                  {t("Board.PlayerReport.BestGames")}
                </Text>
                <ScrollArea.Autosize mah={300} offsetScrollbars type="hover">
                  <BestGamesList games={report.best_games} playerId={playerId} />
                </ScrollArea.Autosize>
              </Stack>
            </>
          )}
        </Stack>
      ) : null}
    </Modal>
  );
}

export default memo(PlayerReportModal);
