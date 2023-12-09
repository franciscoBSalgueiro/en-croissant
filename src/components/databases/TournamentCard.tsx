import { ActionIcon, Paper, Stack, Text, useMantineTheme } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import { NormalizedGame, Tournament, getTournamentGames } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import { useAtom, useSetAtom } from "jotai";
import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { useNavigate } from "react-router-dom";

function PlayerCard({
  tournament,
  file,
}: {
  tournament: Tournament;
  file: string;
}) {
  const [games, setGames] = useState<NormalizedGame[]>([]);
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  useEffect(() => {
    let ignored = false;
    async function fetchGames() {
      const games = await getTournamentGames(file, tournament.id);
      if (ignored) return;
      setGames(games.data);
    }
    fetchGames();

    return () => {
      ignored = true;
    };
  }, [tournament.id, file]);

  const [sort, setSort] = useState<DataTableSortStatus<NormalizedGame>>({
    columnAccessor: "date",
    direction: "asc",
  });

  const sortedGames = games.sort((a, b) => {
    const key = sort.columnAccessor;
    if (sort.direction === "asc") {
      /// @ts-expect-error we know they're the same type
      return a[key] > b[key] ? 1 : -1;
    } else {
      /// @ts-expect-error we know they're the same type
      return a[key] < b[key] ? 1 : -1;
    }
  });

  return (
    <Paper shadow="sm" p="sm" withBorder h="100%">
      <Stack h="100%">
        <Text fz="lg" fw={500}>
          {tournament.name}
        </Text>
        <DataTable<NormalizedGame>
          withTableBorder
          highlightOnHover
          records={sortedGames}
          sortStatus={sort}
          onSortStatusChange={setSort}
          columns={[
            {
              accessor: "actions",
              title: "",
              render: (game) => (
                <ActionIcon
                  variant="filled"
                  color={theme.primaryColor}
                  onClick={() => {
                    createTab({
                      tab: {
                        name: `${game.white} - ${game.black}`,
                        type: "analysis",
                      },
                      setTabs,
                      setActiveTab,
                      pgn: game.moves,
                      headers: game,
                    });
                    navigate("/boards");
                  }}
                >
                  <IconEye size="1rem" stroke={1.5} />
                </ActionIcon>
              ),
            },
            {
              accessor: "white",
              render: ({ white, white_elo }) => (
                <div>
                  <Text size="sm" fw={500}>
                    {white}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {white_elo}
                  </Text>
                </div>
              ),
            },
            {
              accessor: "black",
              render: ({ black, black_elo }) => (
                <div>
                  <Text size="sm" fw={500}>
                    {black}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {black_elo}
                  </Text>
                </div>
              ),
            },
            { accessor: "date", sortable: true },
            { accessor: "result" },
            { accessor: "ply_count", sortable: true },
          ]}
          noRecordsText="No games found"
        />
      </Stack>
    </Paper>
  );
}

export default PlayerCard;
