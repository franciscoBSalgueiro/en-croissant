import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Box, Group, Paper, Text, ActionIcon, Tooltip, Stack, ScrollArea, Divider, Code } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { IconDownload } from "@tabler/icons-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { historyAtom, type HistoryEntry } from "@/state/atoms";
import { z } from "zod";

const searchSchema = z.object({
  selected: z.number().optional(),
});

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  validateSearch: searchSchema,
});

function HistoryPage() {
  const history = useAtomValue(historyAtom) as HistoryEntry[];
  const { selected } = Route.useSearch();
  const navigate = useNavigate();
  const setSelected = (v: number | null) => navigate({ search: { selected: v ?? undefined } });

  async function downloadPgn(row: (typeof history)[number]) {
    const file = await save({
      defaultPath: `${row.white} vs ${row.black} ${row.date ?? ""}.pgn`,
      filters: [{ name: "PGN", extensions: ["pgn"] }],
    });
    if (!file) return;
    await writeFile(file, new TextEncoder().encode(`${row.pgn}\n\n`));
  }

  return (
    <Box p="md" h="100%">
      <Group grow align="start" style={{ overflow: "hidden" }}>
        <Paper withBorder p="md" style={{ flex: 1, minWidth: 0, height: "100%" }}>
          <Group justify="space-between" mb="sm">
            <Text fw={700} fz="lg">Game History ({history.length})</Text>
          </Group>
          <ScrollArea h="calc(100% - 2rem)" offsetScrollbars>
            <DataTable<HistoryEntry>
              withTableBorder
              highlightOnHover
              records={history}
              onRowClick={({ index }) => setSelected(index)}
              rowClassName={(_, i) => (selected === i ? "mantine-ActiveRow" : "")}
              columns={[
                {
                  accessor: "players",
                  title: "Players",
                  render: (r) => (
                    <div>
                      <Text size="sm" fw={500}>{r.white} ({r.whiteElo ?? "-"})</Text>
                      <Text size="xs" c="dimmed">{r.black} ({r.blackElo ?? "-"})</Text>
                    </div>
                  ),
                },
                { accessor: "result", title: "Result", render: (r) => (r.result?.replaceAll("1/2", "½") || "*") },
                { accessor: "accuracy", title: "Accuracy", render: (r) => (
                  <div>
                    <Text size="sm">{r.whiteAccuracy != null ? r.whiteAccuracy.toFixed(1) : "-"}</Text>
                    <Text size="xs" c="dimmed">{r.blackAccuracy != null ? r.blackAccuracy.toFixed(1) : "-"}</Text>
                  </div>
                ) },
                { accessor: "moves", title: "Moves", render: (r) => r.moves ?? "-" },
                { accessor: "date", title: "Date", render: (r) => r.date ? dayjs(r.date).format("MMM D, YYYY") : "-" },
                { accessor: "actions", title: "", render: (r) => (
                  <Tooltip label="Download PGN">
                    <ActionIcon variant="subtle" onClick={() => downloadPgn(r)}>
                      <IconDownload size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                ) },
              ]}
              noRecordsText="No games yet"
            />
          </ScrollArea>
        </Paper>
        <Paper withBorder p="md" style={{ width: 420, height: "100%", minWidth: 320 }}>
          {selected == null || selected < 0 || selected >= history.length ? (
            <Text ta="center">Select a game</Text>
          ) : (
            <GameView game={history[selected]} />
          )}
        </Paper>
      </Group>
    </Box>
  );
}

function GameView({ game }: { game: HistoryEntry }) {
  return (
    <Stack h="100%" gap="xs" style={{ overflow: "hidden" }}>
      <Text fw={700}>Details</Text>
      <Divider variant="dashed" label="Players" />
      <Stack gap={0}>
        <Text size="sm" fw={600}>{game.white} {game.whiteElo ? `(${game.whiteElo})` : ""}</Text>
        <Text size="sm" c="dimmed">{game.black} {game.blackElo ? `(${game.blackElo})` : ""}</Text>
      </Stack>
      <Divider variant="dashed" label="Result" />
      <Text size="sm">{game.result?.replaceAll("1/2", "½") || "*"}</Text>
      <Divider variant="dashed" label="Accuracy" />
      <Stack gap={0}>
        <Text size="sm">White: {game.whiteAccuracy != null ? game.whiteAccuracy.toFixed(1) : "-"}</Text>
        <Text size="sm">Black: {game.blackAccuracy != null ? game.blackAccuracy.toFixed(1) : "-"}</Text>
      </Stack>
      <Divider variant="dashed" label="Meta" />
      <Stack gap={0}>
        <Text size="sm">Moves: {game.moves ?? "-"}</Text>
        <Text size="sm">Date: {game.date ? dayjs(game.date).format("YYYY-MM-DD HH:mm") : "-"}</Text>
      </Stack>
      <Divider variant="dashed" label="PGN" />
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Code block style={{ whiteSpace: "pre-wrap" }}>{game.pgn}</Code>
      </ScrollArea>
    </Stack>
  );
}


