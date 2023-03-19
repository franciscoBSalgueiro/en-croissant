import {
  ActionIcon,
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  Group,
  RangeSlider,
  Select,
  Stack,
  Text,
  useMantineTheme
} from "@mantine/core";
import { useHotkeys, useSessionStorage, useToggle } from "@mantine/hooks";
import { IconDotsVertical, IconEye } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  CompleteGame,
  Database,
  NormalizedGame,
  Outcome,
  query_games,
  Sides
} from "../../utils/db";
import { genID, Tab } from "../tabs/BoardsPage";
import GameCard from "./GameCard";
import { SearchInput } from "./SearchInput";
import useStyles from "./styles";

function GameTable({ database }: { database: Database }) {
  const file = database.file;
  const [games, setGames] = useState<NormalizedGame[]>([]);

  const [count, setCount] = useState(0);
  const [player1, setPlayer1] = useState("");
  const [rangePlayer1, setRangePlayer1] = useState<[number, number]>([0, 3000]);
  const [tempRangePlayer1, setTempRangePlayer1] = useState<[number, number]>([
    0, 3000,
  ]);
  const [player2, setplayer2] = useState("");
  const [rangePlayer2, setRangePlayer2] = useState<[number, number]>([0, 3000]);
  const [tempRangePlayer2, setTempRangePlayer2] = useState<[number, number]>([
    0, 3000,
  ]);
  const [sides, setSides] = useState(Sides.WhiteBlack);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // const [skip, toggleSkip] = useToggle([true, false]);
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState<DataTableSortStatus>({
    columnAccessor: "date",
    direction: "desc",
  });
  const [activePage, setActivePage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [openedSettings, toggleOpenedSettings] = useToggle();

  const theme = useMantineTheme();
  const { classes } = useStyles();

  const router = useRouter();
  const firstId = genID();

  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTab, setActiveTab] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: firstId,
  });

  function createTab(name: string) {
    const id = genID();

    setTabs((prev) => [
      ...prev,
      {
        name,
        value: id,
        type: "analysis",
      },
    ]);
    setActiveTab(id);
    return id;
  }

  useEffect(() => {
    let ignore = false;
    setActivePage(1);
    setSelectedGame(null);
    setLoading(true);
    query_games(file, {
      player1: player1 === "" ? undefined : player1,
      rangePlayer1: rangePlayer1,
      player2: player2 === "" ? undefined : player2,
      rangePlayer2: rangePlayer2,
      sides: sides,
      outcome: outcome === null ? undefined : (outcome as Outcome),
      page: activePage,
      pageSize: limit,
      // skip_count: skip,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      if (!ignore) {
        setLoading(false);
        setGames(res.data);
        setCount(res.count);
      }
    });
    return () => {
      ignore = true;
    };
  }, [
    player1,
    player2,
    outcome,
    // skip,
    limit,
    file,
    sides,
    rangePlayer1,
    rangePlayer2,
  ]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setSelectedGame(null);
    query_games(file, {
      player1: player1 === "" ? undefined : player1,
      player2: player2 === "" ? undefined : player2,
      rangePlayer1: rangePlayer1,
      rangePlayer2: rangePlayer2,
      outcome: outcome === null ? undefined : (outcome as Outcome),
      page: activePage,
      pageSize: limit,
      skip_count: true,
      sort: sort.columnAccessor,
      direction: sort.direction,
    }).then((res) => {
      if (!ignore) {
        setLoading(false);
        setGames(res.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [activePage, sort]);

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
    <Grid my="md" grow>
      <Grid.Col span={3}>
        <Box mb="xl" className={classes.search}>
          <Flex sx={{ gap: 20 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Group grow>
                <SearchInput
                  value={player1}
                  setValue={setPlayer1}
                  sides={sides}
                  setSides={setSides}
                  label="Player"
                  file={file}
                />
                <SearchInput
                  value={player2}
                  setValue={setplayer2}
                  sides={sides}
                  setSides={setSides}
                  label="Opponent"
                  file={file}
                />
              </Group>
              <Collapse in={openedSettings} mx={10}>
                <Stack mt="md">
                  <Group grow>
                    <RangeSlider
                      step={10}
                      min={0}
                      max={3000}
                      marks={[
                        { value: 1000, label: "1000" },
                        { value: 2000, label: "2000" },
                        { value: 3000, label: "3000" },
                      ]}
                      value={tempRangePlayer1}
                      onChange={setTempRangePlayer1}
                      onChangeEnd={setRangePlayer1}
                    />
                    <RangeSlider
                      step={10}
                      min={0}
                      max={3000}
                      marks={[
                        { value: 1000, label: "1000" },
                        { value: 2000, label: "2000" },
                        { value: 3000, label: "3000" },
                      ]}
                      value={tempRangePlayer2}
                      onChange={setTempRangePlayer2}
                      onChangeEnd={setRangePlayer2}
                    />
                  </Group>
                  <Select
                    label="Result"
                    value={outcome}
                    onChange={setOutcome}
                    clearable
                    placeholder="Select result"
                    data={[
                      { label: "White wins", value: Outcome.WhiteWin },
                      { label: "Black wins", value: Outcome.BlackWin },
                      { label: "Draw", value: Outcome.Draw },
                    ]}
                  />
                </Stack>
              </Collapse>
            </Box>
            <ActionIcon
              sx={{ flexGrow: 0 }}
              onClick={() => toggleOpenedSettings()}
            >
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Flex>
        </Box>
        <Box sx={{ height: 500 }}>
          <DataTable
            withBorder
            highlightOnHover
            records={games}
            fetching={loading}
            columns={[
              {
                accessor: "actions",
                title: "",
                render: (game) => (
                  <ActionIcon
                    variant="filled"
                    color={theme.primaryColor}
                    onClick={() => {
                      const id = createTab(
                        `${game.white.name} - ${game.black.name}`
                      );
                      const completeGame: CompleteGame = {
                        game,
                        currentMove: [],
                      };
                      sessionStorage.setItem(id, JSON.stringify(completeGame));
                      router.push("/boards");
                    }}
                  >
                    <IconEye size={16} stroke={1.5} />
                  </ActionIcon>
                ),
              },
              {
                accessor: "white",
                render: ({ white, white_elo }) => (
                  <div>
                    <Text size="sm" weight={500}>
                      {white.name}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {white_elo}
                    </Text>
                  </div>
                ),
              },
              {
                accessor: "black",
                render: ({ black, black_elo }) => (
                  <div>
                    <Text size="sm" weight={500}>
                      {black.name}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {black_elo}
                    </Text>
                  </div>
                ),
              },
              { accessor: "date", sortable: true },
              { accessor: "result" },
              { accessor: "ply_count", sortable: true },
            ]}
            rowClassName={(_, i) =>
              i === selectedGame ? classes.selected : ""
            }
            noRecordsText="No games found"
            totalRecords={count}
            recordsPerPage={limit}
            page={activePage}
            onPageChange={setActivePage}
            onRecordsPerPageChange={setLimit}
            sortStatus={sort}
            onSortStatusChange={setSort}
            recordsPerPageOptions={[10, 25, 50]}
            onRowClick={(_, i) => {
              setSelectedGame(i);
            }}
          />
        </Box>
      </Grid.Col>

      <Grid.Col span={2}>
        {selectedGame !== null ? (
          <GameCard game={games[selectedGame]} />
        ) : (
          <Center h="100%">
            <Text>No game selected</Text>
          </Center>
        )}
      </Grid.Col>
    </Grid>
  );
}

export default GameTable;
