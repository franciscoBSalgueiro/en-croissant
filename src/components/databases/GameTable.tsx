import { Box, Center, Flex, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useStore } from "zustand";
import type { GameSort, NormalizedGame, Outcome, PositionQueryJs } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { query_games } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GameCard from "./GameCard";
import GridLayout from "./GridLayout";
import { GameFilters } from "./GameFilters";
import classes from "./styles.module.css";

function GameTable() {
  const { t } = useTranslation();
  const store = useContext(DatabaseViewStateContext)!;

  const file = useStore(store, (s) => s.database?.file)!;
  const query = useStore(store, (s) => s.games.query);
  const setQuery = useStore(store, (s) => s.setGamesQuery);
  const selectedGame = useStore(store, (s) => s.games.selectedGame);
  const setSelectedGame = useStore(store, (s) => s.setGamesSelectedGame);

  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const { data, error, isLoading, mutate } = useSWR(["games", file, query], () =>
    query_games(file, query),
  );

  const games = data?.data ?? [];
  const count = data?.count;

  useHotkeys([
    [
      "ArrowUp",
      () => {
        setSelectedGame(
          selectedGame === undefined || selectedGame === null
            ? undefined
            : selectedGame === 0
              ? 0
              : selectedGame - 1,
        );
      },
    ],
    [
      "ArrowDown",
      () => {
        setSelectedGame(
          selectedGame === undefined || selectedGame === null
            ? 0
            : selectedGame === games.length - 1
              ? games.length - 1
              : selectedGame + 1,
        );
      },
    ],
  ]);

  return (
    <GridLayout
      search={
        <Box>
          <GameFilters query={query} setQuery={setQuery} file={file} />
        </Box>
      }
      table={
        <DataTable<NormalizedGame>
          withTableBorder
          highlightOnHover
          records={games}
          fetching={isLoading}
          onRowDoubleClick={({ record }) => {
            void createTab({
              tab: {
                name: `${record.white} - ${record.black}`,
                type: "analysis",
              },
              setTabs,
              setActiveTab,
              pgn: record.moves,
              headers: record,
              gameOrigin: {
                kind: "database",
                database: file,
                gameId: record.id,
              },
            });
            void navigate({ to: "/" });
          }}
          columns={[
            {
              accessor: "white",
              noWrap: true,
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
              noWrap: true,
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
            {
              accessor: "result",
              render: ({ result }) => result?.replaceAll("1/2", "½"),
            },
            { accessor: "event", noWrap: true },
            { accessor: "ply_count", title: "Plies", sortable: true },
            { accessor: "site", noWrap: true },
          ]}
          rowClassName={(_, i) => (i === selectedGame ? classes.selected : "")}
          noRecordsText={
            error
              ? `${t("Common.Error")}: ${error instanceof Error ? error.message : String(error)}`
              : "No games found"
          }
          totalRecords={count!}
          recordsPerPage={query.options?.pageSize ?? 25}
          page={query.options?.page ?? 1}
          onPageChange={(page) =>
            setQuery({
              ...query,
              options: {
                ...query.options!,
                page,
              },
            })
          }
          onRecordsPerPageChange={(value) =>
            setQuery({
              ...query,
              options: { ...query.options!, pageSize: value },
            })
          }
          sortStatus={{
            columnAccessor: query.options?.sort || "date",
            direction: query.options?.direction || "desc",
          }}
          onSortStatusChange={(value) =>
            setQuery({
              ...query,
              options: {
                ...query.options!,
                sort: value.columnAccessor as GameSort,
                direction: value.direction,
              },
            })
          }
          recordsPerPageOptions={[10, 25, 50]}
          onRowClick={({ index }) => {
            setSelectedGame(index);
          }}
        />
      }
      preview={
        selectedGame !== undefined && selectedGame !== null && games[selectedGame] ? (
          <GameCard game={games[selectedGame]} file={file} mutate={mutate} />
        ) : (
          <Center h="100%">
            <Text>{t("Databases.Game.NoSelection")}</Text>
          </Center>
        )
      }
    />
  );
}

export default GameTable;
