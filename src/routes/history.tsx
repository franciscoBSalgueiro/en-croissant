import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Box, Group, Paper, Text, ActionIcon, Tooltip, Stack, ScrollArea, Divider, Code, Tabs } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { IconDownload } from "@tabler/icons-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { historyAtom, type HistoryEntry } from "@/state/atoms";
import { z } from "zod";
import { memo, useMemo } from "react";

// AG Grid imports
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { GridOptions } from 'ag-grid-community';

// Game preview imports
import GamePreviewWrapper from "@/components/databases/GamePreview";
import type { UnifiedMove } from "@/state/unifiedMoves";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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

  // Stable IDs for DataTable rows to avoid React key warnings
  const historyRecords = useMemo(
    () =>
      history.map((r, i) => ({
        ...r,
        _id: `${r.date ?? ""}-${r.time ?? ""}-${i}-${r.pgn.length}`,
      })),
    [history],
  );

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
            <DataTable<any>
              withTableBorder
              highlightOnHover
              idAccessor="_id"
              records={historyRecords}
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
      <Text fw={700}>Game Analysis</Text>
      
      <Tabs defaultValue="overview" style={{ flex: 1, minHeight: 0 }}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="moves">Moves</Tabs.Tab>
          <Tabs.Tab value="preview">Preview</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" style={{ height: "calc(100% - 40px)", overflow: "hidden" }}>
          <ScrollArea h="100%" offsetScrollbars>
            <Stack gap="xs">
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
              <Code block style={{ whiteSpace: "pre-wrap" }}>{game.pgn}</Code>
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="moves" style={{ height: "calc(100% - 40px)", overflow: "hidden" }}>
          <UnifiedMovesGrid game={game} />
        </Tabs.Panel>

        <Tabs.Panel value="preview" style={{ height: "calc(100% - 40px)", overflow: "hidden" }}>
          <GamePreviewWrapper 
            pgn={game.pgn}
            showOpening 
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// AG Grid component for displaying unified moves from the stored game
function UnifiedMovesGrid({ game }: { game: HistoryEntry }) {
  // Extract unified moves from the stored game data
  const unifiedMoves: UnifiedMove[] = game.unifiedMainline || [];

  // Basic cell renderers for the grid
  const NumberCellRenderer = (props: any) => {
    const { value } = props;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="sm" fw={500}>{value || "-"}</Text>
      </div>
    );
  };

  const PercentageCellRenderer = (props: any) => {
    const { value } = props;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {typeof value === 'number' ? (
          <Text size="sm">{value.toFixed(1)}%</Text>
        ) : (
          <Text size="xs" c="dimmed">-</Text>
        )}
      </div>
    );
  };

  const MoveCellRenderer = (props: any) => {
    const { value, data } = props;
    const displayValue = value || data?.san || data?.move || '';
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
        <Text size="sm" fw={500}>{displayValue}</Text>
      </div>
    );
  };

  const ScoreCellRenderer = (props: any) => {
    const { data } = props;
    const score = data?.score;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {score ? (
          <Text size="sm">{score.value?.cp ? `${score.value.cp > 0 ? '+' : ''}${(score.value.cp / 100).toFixed(2)}` : 
            score.value?.mate ? `M${score.value.mate}` : "-"}</Text>
        ) : (
          <Text size="xs" c="dimmed">-</Text>
        )}
      </div>
    );
  };

  const gridOptions: GridOptions = {
    defaultColDef: {
      resizable: true,
      cellStyle: { padding: '0 6px' },
    },
    rowHeight: 35,
    headerHeight: 35,
    columnDefs: [
      {
        headerName: "Move",
        field: "san",
        width: 100,
        cellRenderer: MoveCellRenderer,
        pinned: 'left',
        valueGetter: (params) => params.data?.san || params.data?.move || '',
      },
      {
        headerName: "Rank",
        field: "rank",
        width: 80,
        cellRenderer: NumberCellRenderer,
        sortable: true,
      },
      {
        headerName: "Score",
        field: "score",
        width: 100,
        cellRenderer: ScoreCellRenderer,
        sortable: true,
      },
      {
        headerName: "Win %",
        field: "winChance",
        width: 90,
        cellRenderer: PercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "Confidence",
        field: "confidence",
        width: 100,
        cellRenderer: PercentageCellRenderer,
        sortable: true,
      },
      {
        headerName: "Source",
        field: "source",
        width: 90,
        cellRenderer: (props: any) => {
          const { value } = props;
          return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text size="xs" tt="uppercase">{value || "-"}</Text>
            </div>
          );
        },
        sortable: true,
      },
      {
        headerName: "Engine",
        field: "engineName",
        width: 100,
        cellRenderer: (props: any) => {
          const { value } = props;
          return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text size="xs">{value || "-"}</Text>
            </div>
          );
        },
        sortable: false,
      },
    ],
  };

  if (unifiedMoves.length === 0) {
    return (
      <Stack h="100%" justify="center" align="center">
        <Text c="dimmed">No unified moves data available for this game</Text>
        <Text size="xs" c="dimmed">Unified moves are only stored for recent games</Text>
      </Stack>
    );
  }

  return (
    <Stack h="100%" gap="xs" style={{ minHeight: 0 }}>
      <Text size="sm" fw={500}>
        Stored Moves Analysis ({unifiedMoves.length} moves)
      </Text>
      
      <div style={{ height: '100%', width: '100%', flex: 1, minHeight: 200 }}>
        <AgGridReact<UnifiedMove>
          theme={themeQuartz}
          rowData={unifiedMoves}
          gridOptions={gridOptions}
          domLayout="normal"
          suppressHorizontalScroll={false}
          suppressDragLeaveHidesColumns={true}
          suppressScrollOnNewData={true}
          suppressRowVirtualisation={false}
        />
      </div>
    </Stack>
  );
}

export default memo(HistoryPage);


