import type { GameSort, NormalizedGame, Outcome } from "@/bindings";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { query_games } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import {
  ActionIcon,
  Box,
  Center,
  Collapse,
  Flex,
  Group,
  InputWrapper,
  RangeSlider,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useHotkeys } from "@mantine/hooks";
import { IconDotsVertical } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { useContext } from "react";
import useSWR from "swr";
import { useStore } from "zustand";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GameCard from "./GameCard";
import GridLayout from "./GridLayout";
import { PlayerSearchInput } from "./PlayerSearchInput";
import { SideInput } from "./SideInput";
import * as classes from "./styles.css";

function GameTable() {
  const store = useContext(DatabaseViewStateContext)!;

  const file = useStore(store, (s) => s.database?.file)!;
  const query = useStore(store, (s) => s.games.query);
  const setQuery = useStore(store, (s) => s.setGamesQuery);
  const openedSettings = useStore(store, (s) => s.games.isFilterExpanded);
  const toggleOpenedSettings = useStore(
    store,
    (s) => s.toggleGamesOpenedSettings,
  );

  const selectedGame = useStore(store, (s) => s.games.selectedGame);
  const setSelectedGame = useStore(store, (s) => s.setGamesSelectedGame);

  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const { data, isLoading, mutate } = useSWR(["games", query], () =>
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
    <>
      <GridLayout
        search={
          <Flex style={{ gap: 20 }}>
            <Box style={{ flexGrow: 1 }}>
              <Group grow>
                <PlayerSearchInput
                  value={query?.player1 ?? undefined}
                  setValue={(value) => setQuery({ ...query, player1: value })}
                  rightSection={
                    <SideInput
                      sides={query.sides!}
                      setSides={(value) => setQuery({ ...query, sides: value })}
                      label="Player"
                    />
                  }
                  label="Player"
                  file={file}
                />
                <PlayerSearchInput
                  value={query?.player2 ?? undefined}
                  setValue={(value) => setQuery({ ...query, player2: value })}
                  rightSection={
                    <SideInput
                      sides={query.sides!}
                      setSides={(value) => setQuery({ ...query, sides: value })}
                      label="Opponent"
                    />
                  }
                  label="Opponent"
                  file={file}
                />
              </Group>
              <Collapse in={openedSettings} mx={10}>
                <Stack mt="md">
                  <Group grow>
                    <InputWrapper label="ELO">
                      <RangeSlider
                        step={10}
                        min={0}
                        max={3000}
                        marks={[
                          { value: 1000, label: "1000" },
                          { value: 2000, label: "2000" },
                          { value: 3000, label: "3000" },
                        ]}
                        value={query.range1 ?? undefined}
                        onChangeEnd={(value) =>
                          setQuery({ ...query, range1: value })
                        }
                      />
                    </InputWrapper>

                    <InputWrapper label="ELO">
                      <RangeSlider
                        step={10}
                        min={0}
                        max={3000}
                        marks={[
                          { value: 1000, label: "1000" },
                          { value: 2000, label: "2000" },
                          { value: 3000, label: "3000" },
                        ]}
                        value={query.range2 ?? undefined}
                        onChangeEnd={(value) =>
                          setQuery({ ...query, range2: value })
                        }
                      />
                    </InputWrapper>
                  </Group>
                  <Select
                    label="Result"
                    value={query.outcome}
                    onChange={(value) =>
                      setQuery({
                        ...query,
                        outcome: (value as Outcome | null) ?? undefined,
                      })
                    }
                    clearable
                    placeholder="Select result"
                    data={[
                      { label: "White wins", value: "1-0" },
                      { label: "Black wins", value: "0-1" },
                      { label: "Draw", value: "1/2-1/2" },
                    ]}
                  />
                  <Group>
                    <DateInput
                      label="From"
                      placeholder="Start date"
                      clearable
                      valueFormat="YYYY-MM-DD"
                      value={
                        query.start_date
                          ? dayjs(query.start_date, "YYYY.MM.DD").toDate()
                          : null
                      }
                      onChange={(value) =>
                        setQuery({
                          ...query,
                          start_date: value
                            ? dayjs(value).format("YYYY.MM.DD")
                            : undefined,
                        })
                      }
                    />
                    <DateInput
                      label="To"
                      placeholder="End date"
                      clearable
                      valueFormat="YYYY-MM-DD"
                      value={
                        query.end_date
                          ? dayjs(query.end_date, "YYYY.MM.DD").toDate()
                          : null
                      }
                      onChange={(value) =>
                        setQuery({
                          ...query,
                          end_date: value
                            ? dayjs(value).format("YYYY.MM.DD")
                            : undefined,
                        })
                      }
                    />
                  </Group>
                </Stack>
              </Collapse>
            </Box>
            <ActionIcon
              style={{ flexGrow: 0 }}
              onClick={() => toggleOpenedSettings()}
            >
              <IconDotsVertical size="1rem" />
            </ActionIcon>
          </Flex>
        }
        table={
          <DataTable<NormalizedGame>
            withTableBorder
            highlightOnHover
            records={games}
            fetching={isLoading}
            onRowDoubleClick={({ record }) => {
              createTab({
                tab: {
                  name: `${record.white} - ${record.black}`,
                  type: "analysis",
                },
                setTabs,
                setActiveTab,
                pgn: record.moves,
                headers: record,
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
              {
                accessor: "result",
                render: ({ result }) => result?.replaceAll("1/2", "½"),
              },
              { accessor: "ply_count", title: "Plies", sortable: true },
              { accessor: "event" },
              { accessor: "site" },
            ]}
            rowClassName={(_, i) =>
              i === selectedGame ? classes.selected : ""
            }
            noRecordsText="No games found"
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
          selectedGame !== undefined &&
          selectedGame !== null &&
          games[selectedGame] ? (
            <GameCard game={games[selectedGame]} file={file} mutate={mutate} />
          ) : (
            <Center h="100%">
              <Text>No game selected</Text>
            </Center>
          )
        }
      />
    </>
  );
}

export default GameTable;
