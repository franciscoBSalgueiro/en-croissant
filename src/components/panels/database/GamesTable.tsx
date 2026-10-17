import { Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useState } from "react";
import type { NormalizedGame } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";

function GamesTable({
  games,
  loading,
  databasePath,
  pagination,
}: {
  games: NormalizedGame[];
  loading: boolean;
  databasePath?: string | null;
  pagination?: {
    page: number;
    totalRecords: number;
    onPageChange: (page: number) => void;
  };
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [localPagination, setLocalPagination] = useState({ games, page: 1 });
  const page = localPagination.games === games ? localPagination.page : 1;
  const setPage = (page: number) => setLocalPagination({ games, page });
  const filteredGames = pagination ? games : games.slice((page - 1) * 20, page * 20);

  const navigate = useNavigate();
  return (
    <DataTable
      withTableBorder
      highlightOnHover
      records={filteredGames}
      fetching={loading}
      totalRecords={pagination?.totalRecords ?? games.length}
      recordsPerPage={20}
      page={pagination?.page ?? page}
      onPageChange={pagination?.onPageChange ?? setPage}
      onRowClick={(e) => {
        const game = e.record;
        createTab({
          tab: {
            name: `${game.white} - ${game.black}`,
            type: "analysis",
          },
          setTabs,
          setActiveTab,
          pgn: game.moves,
          headers: game,
          gameOrigin: databasePath
            ? {
                kind: "database",
                database: databasePath,
                gameId: game.id,
              }
            : undefined,
        });
        navigate({ to: "/" });
      }}
      columns={[
        {
          accessor: "white",
          render: ({ white, white_elo }) => (
            <div>
              <Text size="sm" fw={500}>
                {white}
              </Text>
              <Text size="xs" c="dimmed">
                {white_elo === 0 ? "Unrated" : white_elo}
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
                {black_elo === 0 ? "Unrated" : black_elo}
              </Text>
            </div>
          ),
        },
        { accessor: "date" },
        { accessor: "result" },
        { accessor: "ply_count" },
      ]}
      noRecordsText="No games found"
    />
  );
}

export default memo(GamesTable);
