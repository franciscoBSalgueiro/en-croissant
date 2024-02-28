import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import {
  DatabaseInfo,
  GameQuery,
  NormalizedGame,
  Outcome,
  query_games,
} from "@/utils/db";
import { invoke } from "@/utils/invoke";
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
  useMantineTheme,
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import { IconDotsVertical, IconEye, IconTrash } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import GameCard from "./GameCard";
import GridLayout from "./GridLayout";
import { PlayerSearchInput } from "./PlayerSearchInput";
import { SideInput } from "./SideInput";
import * as classes from "./styles.css";

function GameTable({ database }: { database: DatabaseInfo }) {
  const file = database.file;
  const [query, setQuery] = useState<GameQuery>({
    player1: undefined,
    rangePlayer1: [0, 3000],
    player2: undefined,
    rangePlayer2: [0, 3000],
    sides: "WhiteBlack",
    outcome: undefined,
    sort: "date",
    direction: "desc",
    pageSize: 25,
    page: 1,
  });

  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [openedSettings, toggleOpenedSettings] = useToggle();

  const theme = useMantineTheme();

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
        setSelectedGame((prev) => {
          if (prev === null) {
            return null;
          }
          if (prev === 0) {
            return 0;
          }
          return prev - 1;
        });
      },
    ],
    [
      "ArrowDown",
      () => {
        setSelectedGame((prev) => {
          if (prev === null) {
            return 0;
          }
          if (prev === games.length - 1) {
            return games.length - 1;
          }
          return prev + 1;
        });
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
                        onChangeEnd={(value) =>
                          setQuery({ ...query, rangePlayer1: value })
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
                        onChangeEnd={(value) =>
                          setQuery({ ...query, rangePlayer2: value })
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
              navigate("/");
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
            totalRecords={count}
            recordsPerPage={query.pageSize ?? 25}
            page={query.page ?? 1}
            onPageChange={(page) => setQuery({ ...query, page })}
            onRecordsPerPageChange={(value) =>
              setQuery({ ...query, pageSize: value })
            }
            sortStatus={{
              columnAccessor: query.sort,
              direction: query.direction,
            }}
            onSortStatusChange={(value) =>
              setQuery({
                ...query,
                sort: value.columnAccessor,
                direction: value.direction,
              })
            }
            recordsPerPageOptions={[10, 25, 50]}
            onRowClick={({ index }) => {
              setSelectedGame(index);
            }}
          />
        }
        preview={
          selectedGame !== null && games[selectedGame] ? (
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
