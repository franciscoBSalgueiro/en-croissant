import { Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NormalizedGame } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { createTab } from "@/utils/tabs";

function isEmptyOrUnknownDate(d: string | null | undefined): boolean {
  if (d == null || d.trim() === "") return true;
  return d.includes("?");
}

function compareGameDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: "asc" | "desc",
): number {
  const emptyA = isEmptyOrUnknownDate(a);
  const emptyB = isEmptyOrUnknownDate(b);
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  const cmp = a!.localeCompare(b!, undefined, { numeric: true });
  return direction === "asc" ? cmp : -cmp;
}

function sortGamesList(
  games: NormalizedGame[],
  sort: DataTableSortStatus<NormalizedGame>,
): NormalizedGame[] {
  const col = sort.columnAccessor;
  const dir = sort.direction;
  const mult = dir === "asc" ? 1 : -1;

  return [...games].sort((a, b) => {
    if (col === "white") {
      return (
        mult * (a.white || "").localeCompare(b.white || "", undefined, { sensitivity: "base" })
      );
    }
    if (col === "black") {
      return (
        mult * (a.black || "").localeCompare(b.black || "", undefined, { sensitivity: "base" })
      );
    }
    if (col === "date") {
      return compareGameDates(a.date, b.date, dir);
    }
    return 0;
  });
}

function GamesTable({
  games,
  loading,
  databasePath,
}: {
  games: NormalizedGame[];
  loading: boolean;
  databasePath?: string | null;
}) {
  const { t } = useTranslation();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [page, setPage] = useState(1);
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<NormalizedGame>>({
    columnAccessor: "date",
    direction: "desc",
  });

  const sortedGames = useMemo(() => sortGamesList(games, sortStatus), [games, sortStatus]);

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
      totalRecords={sortedGames.length}
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
          title: t("Common.WHITE"),
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
          title: t("Common.BLACK"),
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
        { accessor: "date", title: t("Common.Date"), sortable: true },
        { accessor: "result" },
        { accessor: "ply_count" },
      ]}
      noRecordsText="No games found"
    />
  );
}

export default memo(GamesTable);
