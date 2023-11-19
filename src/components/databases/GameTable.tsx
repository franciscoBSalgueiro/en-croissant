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
  useMantineTheme,
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import { IconDotsVertical, IconEye } from "@tabler/icons-react";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";
import {
  DatabaseInfo,
  NormalizedGame,
  Outcome,
  Sides,
  query_games,
} from "@/utils/db";
import { createTab } from "@/utils/tabs";
import GameCard from "./GameCard";
import { SearchInput } from "./SearchInput";
import useStyles from "./styles";
import { useAtom, useSetAtom } from "jotai";
import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { useNavigate } from "react-router-dom";

function GameTable({ database }: { database: DatabaseInfo }) {
  const file = database.file;
  const [games, setGames] = useState<NormalizedGame[]>([]);

  const [count, setCount] = useState(0);
  const [player1, setPlayer1] = useState<number | undefined>();
  const [rangePlayer1, setRangePlayer1] = useState<[number, number]>([0, 3000]);
  const [tempRangePlayer1, setTempRangePlayer1] = useState<[number, number]>([
    0, 3000,
  ]);
  const [player2, setplayer2] = useState<number | undefined>();
  const [rangePlayer2, setRangePlayer2] = useState<[number, number]>([0, 3000]);
  const [tempRangePlayer2, setTempRangePlayer2] = useState<[number, number]>([
    0, 3000,
  ]);
  const [sides, setSides] = useState<Sides>("WhiteBlack");
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

  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  useEffect(() => {
    let ignore = false;
    setActivePage(1);
    setSelectedGame(null);
    setLoading(true);
    query_games(file, {
      player1,
      rangePlayer1: rangePlayer1,
      player2,
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
      player1,
      player2,
      rangePlayer1: rangePlayer1,
      rangePlayer2: rangePlayer2,
      outcome: outcome === null ? undefined : (outcome as Outcome),
      sides: sides,
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
                  setValue={setPlayer1}
                  sides={sides}
                  setSides={setSides}
                  label="Player"
                  file={file}
                />
                <SearchInput
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
                      { label: "White wins", value: "1-0" },
                      { label: "Black wins", value: "0-1" },
                      { label: "Draw", value: "1/2-1/2" },
                    ]}
                  />
                </Stack>
              </Collapse>
            </Box>
            <ActionIcon
              sx={{ flexGrow: 0 }}
              onClick={() => toggleOpenedSettings()}
            >
              <IconDotsVertical size="1rem" />
            </ActionIcon>
          </Flex>
        </Box>
        <DataTable
          height={500}
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
                  <Text size="sm" weight={500}>
                    {white}
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
                    {black}
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
          rowClassName={(_, i) => (i === selectedGame ? classes.selected : "")}
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
