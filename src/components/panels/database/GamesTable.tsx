import { Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { memo, useEffect, useMemo, useState } from "react";
import type { NormalizedGame } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";

function GamesTable({
  games,
  loading,
  databasePath,
}: {
  games: NormalizedGame[];
  loading: boolean;
  databasePath?: string | null;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [page, setPage] = useState(1);
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<NormalizedGame>>({
    columnAccessor: "date",
    direction: "desc",
  });

  // Sorts the full result set client-side according to the current sort status
  // (column + direction), before pagination slices out the visible page.
  // The column accessor is a key of NormalizedGame, so the values being
  // compared are strings (player names, date), numbers (ply count) or
  // null/undefined (optional fields like date and ply_count). Strings are
  // compared with localeCompare, numbers with </>, and missing values are
  // always pushed to the end regardless of direction. The comparison result
  // is negated for descending order. Memoized so the sort only reruns when
  // the games or the sort status change, not on every render (e.g. paging).
  const sortedGames = useMemo(() => {
    const key = sortStatus.columnAccessor as keyof NormalizedGame;
    return [...games].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // missing values always sort last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : av < bv
            ? -1
            : av > bv
              ? 1
              : 0;
      return sortStatus.direction === "desc" ? -cmp : cmp;
    });
  }, [games, sortStatus]);
  const filteredGames = sortedGames.slice((page - 1) * 20, page * 20);

  useEffect(() => {
    setPage(1);
  }, [games, sortStatus]);

  const navigate = useNavigate();
  return (
    <DataTable
      withTableBorder
      highlightOnHover
      records={filteredGames}
      fetching={loading}
      totalRecords={games.length}
      recordsPerPage={20}
      page={page}
      onPageChange={setPage}
      sortStatus={sortStatus}
      onSortStatusChange={setSortStatus}
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
          sortable: true,
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
          sortable: true,
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
        { accessor: "date", sortable: true },
        { accessor: "result", sortable: true },
        { accessor: "ply_count", sortable: true },
      ]}
      noRecordsText="No games found"
    />
  );
}

export default memo(GamesTable);
