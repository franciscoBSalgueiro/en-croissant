import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Collapse,
  Grid,
  Group,
  Pagination,
  Paper,
  RangeSlider,
  Select,
  Stack,
  Text,
  Tooltip
} from "@mantine/core";
import { useHotkeys, useToggle } from "@mantine/hooks";
import {
  IconSearch,
  IconSortAscending,
  IconSortDescending
} from "@tabler/icons";
import { useEffect, useRef, useState } from "react";
import {
  Database,
  NormalizedGame,
  Outcome,
  query_games,
  Sides
} from "../../utils/db";
import { formatNumber } from "../../utils/format";
import GameCard from "./GameCard";
import GameSubTable from "./GameSubTable";
import { SearchInput } from "./SearchInput";

const sortOptions = [
  { label: "ID", value: "id" },
  { label: "Date", value: "date" },
  { label: "White ELO", value: "whiteElo" },
  { label: "Black ELO", value: "blackElo" },
];

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
  const [skip, toggleSkip] = useToggle([true, false]);
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState("id");
  const [direction, toggleDirection] = useToggle(["desc", "asc"] as const);
  const [activePage, setActivePage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [openedSettings, toggleOpenedSettings] = useToggle();
  const viewport = useRef<HTMLDivElement>(null);
  const scrollToTop = () => viewport.current?.scrollTo({ top: 0 });

  useEffect(() => {
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
      skip_count: skip,
      sort,
      direction,
    }).then((res) => {
      setLoading(false);
      setGames(res.data);
      setCount(res.count);
    });
  }, [
    player1,
    player2,
    outcome,
    skip,
    limit,
    file,
    sides,
    rangePlayer1,
    rangePlayer2,
  ]);

  useEffect(() => {
    setLoading(true);
    scrollToTop();
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
      sort,
      direction,
    }).then((res) => {
      setLoading(false);
      setGames(res.data);
    });
  }, [activePage, sort, direction]);

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
      <Grid grow>
        <Grid.Col span={3}>
          <Group position="apart">
            <Button
              my={15}
              compact
              variant="outline"
              leftIcon={<IconSearch size={15} />}
              onClick={() => toggleOpenedSettings()}
            >
              Search Settings
            </Button>

            <Paper withBorder>
              <Group spacing={0}>
                <ActionIcon mx="xs" onClick={() => toggleDirection()}>
                  {direction === "asc" ? (
                    <IconSortDescending size={20} />
                  ) : (
                    <IconSortAscending size={20} />
                  )}
                </ActionIcon>
                <Select
                  variant="unstyled"
                  value={sort}
                  onChange={(v) => {
                    v && setSort(v);
                  }}
                  data={sortOptions}
                  defaultValue={sort}
                />
              </Group>
            </Paper>
          </Group>

          <Collapse in={openedSettings} mx={10}>
            <Stack>
              <Group grow>
                <Stack>
                  <SearchInput
                    value={player1}
                    setValue={setPlayer1}
                    sides={sides}
                    setSides={setSides}
                    label="Player"
                    file={file}
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
                    value={tempRangePlayer1}
                    onChange={setTempRangePlayer1}
                    onChangeEnd={setRangePlayer1}
                  />
                </Stack>
                <Stack>
                  <SearchInput
                    value={player2}
                    setValue={setplayer2}
                    sides={sides}
                    setSides={setSides}
                    label="Opponent"
                    file={file}
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
                </Stack>
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
              <Tooltip label="Disabling this may significantly improve performance">
                <Checkbox
                  label="Include pagination"
                  checked={!skip}
                  onChange={() => toggleSkip()}
                />
              </Tooltip>
            </Stack>
          </Collapse>
          <GameSubTable
            height={600}
            games={games}
            loading={loading}
            selectedGame={selectedGame}
            setSelectedGame={setSelectedGame}
          />
          {!skip && (
            <>
              <Select
                label="Results per page"
                value={limit.toString()}
                onChange={(v) => {
                  v && setLimit(parseInt(v));
                }}
                sx={{ float: "right" }}
                data={["10", "25", "50", "100"]}
                defaultValue={limit.toString()}
              />
              <Stack spacing={0} mt={20}>
                <Pagination
                  page={activePage}
                  onChange={setActivePage}
                  total={Math.ceil(count / limit)}
                />
                <Text weight={500} align="center" p={20}>
                  {formatNumber(count)} games
                </Text>
              </Stack>
            </>
          )}
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
    </>
  );
}

export default GameTable;
