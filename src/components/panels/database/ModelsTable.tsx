import { Box, Button, Group, Progress, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { DataTable } from "mantine-datatable";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ModelGamesReport, ModelPlayerStat, NormalizedGame } from "@/bindings";
import { formatNumber } from "@/utils/format";
import classes from "./OpeningsTable.module.css";

function ResultBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  const winsPercent = total > 0 ? (wins / total) * 100 : 0;
  const drawsPercent = total > 0 ? (draws / total) * 100 : 0;
  const lossesPercent = total > 0 ? (losses / total) * 100 : 0;
  return (
    <Progress.Root size="xl" className={classes.result}>
      <Progress.Section value={winsPercent} className={classes.whiteResultsSection}>
        <Progress.Label c="black">
          {winsPercent > 15 ? `${winsPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={drawsPercent} color="gray">
        <Progress.Label>{drawsPercent > 15 ? `${drawsPercent.toFixed(1)}%` : ""}</Progress.Label>
      </Progress.Section>
      <Progress.Section value={lossesPercent} color="black">
        <Progress.Label>{lossesPercent > 15 ? `${lossesPercent.toFixed(1)}%` : ""}</Progress.Label>
      </Progress.Section>
    </Progress.Root>
  );
}

function PlayerCell({ name, elo }: { name: string; elo?: number | null }) {
  return (
    <div>
      <Text size="sm" fw={500}>
        {name}
      </Text>
      <Text size="xs" c="dimmed">
        {!elo ? "Unrated" : elo}
      </Text>
    </div>
  );
}

function ModelPlayersTable({ players, loading }: { players: ModelPlayerStat[]; loading: boolean }) {
  const { t } = useTranslation();
  const records = [...players].sort((a, b) => b.games - a.games);

  return (
    <DataTable
      withTableBorder
      highlightOnHover
      records={records}
      fetching={loading || players === null}
      columns={[
        {
          accessor: "name",
          title: t("Common.Name"),
          width: 160,
          render: ({ name }) => (
            <Text fz="sm" fw={500}>
              {name}
            </Text>
          ),
        },
        {
          accessor: "elo",
          title: t("Board.Database.Elo"),
          width: 80,
          textAlign: "right",
          render: ({ elo }) => <Text fz="sm">{elo === null || elo === 0 ? "—" : elo}</Text>,
        },
        {
          accessor: "games",
          title: t("Board.Database.Games"),
          width: 90,
          textAlign: "right",
          render: ({ games }) => <Text fz="sm">{formatNumber(games)}</Text>,
        },
        {
          accessor: "results",
          title: t("Board.Database.Total"),
          render: ({ wins, draws, losses }) => (
            <ResultBar wins={wins} draws={draws} losses={losses} />
          ),
        },
      ]}
      idAccessor="name"
      emptyState={
        <Text fz="sm" c="dimmed">
          {t("Board.Database.NoResults")}
        </Text>
      }
    />
  );
}

function ModelGamesList({
  games,
  loading,
  onTrain,
}: {
  games: NormalizedGame[];
  loading: boolean;
  onTrain: (game: NormalizedGame) => void;
}) {
  const { t } = useTranslation();

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ScrollArea flex={1} offsetScrollbars>
        <Table highlightOnHover fz="sm" withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w="25%">{t("Fen.White")}</Table.Th>
              <Table.Th w="25%">{t("Fen.Black")}</Table.Th>
              <Table.Th w={70}>{t("Board.Analysis.Result")}</Table.Th>
              <Table.Th w={90}>{t("Common.Date")}</Table.Th>
              <Table.Th w={60}>ECO</Table.Th>
              <Table.Th w={0} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && games.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text fz="sm" c="dimmed">
                    {t("Common.Loading")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {!loading && games.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text fz="sm" c="dimmed">
                    {t("Board.Database.NoResults")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {games.map((game) => (
              <Table.Tr key={game.id}>
                <Table.Td>
                  <PlayerCell name={game.white} elo={game.white_elo} />
                </Table.Td>
                <Table.Td>
                  <PlayerCell name={game.black} elo={game.black_elo} />
                </Table.Td>
                <Table.Td>{game.result}</Table.Td>
                <Table.Td>{game.date ?? "—"}</Table.Td>
                <Table.Td>{game.eco ?? "—"}</Table.Td>
                <Table.Td>
                  <Group gap={0} justify="flex-end" wrap="nowrap">
                    <Button
                      size="compact-xs"
                      variant="light"
                      leftSection={<IconPlayerPlay size="0.8rem" />}
                      onClick={() => onTrain(game)}
                    >
                      {t("Board.Database.Train")}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}

function ModelsTable({
  report,
  loading,
  onTrain,
}: {
  report: ModelGamesReport | undefined;
  loading: boolean;
  onTrain: (game: NormalizedGame) => void;
}) {
  const { t } = useTranslation();

  return (
    <Stack gap="sm" style={{ flex: 1, overflow: "hidden" }}>
      <Stack gap={4}>
        <Text fz="sm" fw={600}>
          {t("Board.Database.ModelPlayers")}
        </Text>
        <ModelPlayersTable players={report?.players ?? []} loading={loading} />
      </Stack>
      <Stack gap={4} style={{ flex: 1, overflow: "hidden" }} mih={120}>
        <Text fz="sm" fw={600}>
          {t("Board.Database.ModelGames")}
        </Text>
        <ModelGamesList games={report?.games ?? []} loading={loading} onTrain={onTrain} />
      </Stack>
    </Stack>
  );
}

export default memo(ModelsTable);
