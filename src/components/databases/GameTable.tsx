import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  Checkbox,
  Collapse,
  createStyles,
  Grid,
  Group,
  LoadingOverlay,
  Pagination,
  Paper,
  RangeSlider,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
  useMantineTheme
} from "@mantine/core";
import { useHotkeys, useSessionStorage, useToggle } from "@mantine/hooks";
import {
  IconEye,
  IconSearch,
  IconSortAscending,
  IconSortDescending
} from "@tabler/icons";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  CompleteGame,
  Database,
  Game,
  Outcome,
  Player,
  query_games,
  Sides,
  Speed
} from "../../utils/db";
import { genID, Tab } from "../tabs/BoardsPage";
import GameCard from "./GameCard";
import { SearchInput } from "./SearchInput";
import SpeeedBadge from "./SpeedBadge";

const useStyles = createStyles((theme) => ({
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    transition: "box-shadow 150ms ease",

    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderBottom: `1px solid ${
        theme.colorScheme === "dark"
          ? theme.colors.dark[3]
          : theme.colors.gray[2]
      }`,
    },
  },
  scrolled: {
    boxShadow: theme.shadows.sm,
  },
  row: {
    cursor: "pointer",
    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.white,
    },
  },
  rowSelected: {
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.2)
        : theme.colors[theme.primaryColor][0],

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.2)
          : theme.colors[theme.primaryColor][0],
    },
  },
}));

const sortOptions = [
  { label: "Date", value: "date" },
  { label: "Rating", value: "rating" },
  { label: "Speed", value: "speed" },
  { label: "Outcome", value: "outcome" },
];

function GameTable({ database }: { database: Database }) {
  const { classes, cx } = useStyles();
  const router = useRouter();
  const file = database.file;
  const [games, setGames] = useState<[Game, Player, Player][]>([]);

  const [count, setCount] = useState(0);
  const [player1, setPlayer1] = useState("");
  const [rangePlayer1, setRangePlayer1] = useState<[number, number]>([0, 3000]);
  const [player2, setplayer2] = useState("");
  const [rangePlayer2, setRangePlayer2] = useState<[number, number]>([0, 3000]);
  const [sides, setSides] = useState(Sides.Any);
  const [speed, setSpeed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skip, toggleSkip] = useToggle();
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState("date");
  const [direction, toggleDirection] = useToggle(["asc", "desc"] as const);
  const [activePage, setActivePage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const offset = (activePage - 1) * limit;
  const [scrolled, setScrolled] = useState(false);
  const [openedSettings, toggleOpenedSettings] = useToggle();
  const viewport = useRef<HTMLDivElement>(null);
  const scrollToTop = () => viewport.current?.scrollTo({ top: 0 });
  const firstId = genID();
  const [tabs, setTabs] = useSessionStorage<Tab[]>({
    key: "tabs",
    defaultValue: [],
  });
  const [activeTab, setActiveTab] = useSessionStorage<string | null>({
    key: "activeTab",
    defaultValue: firstId,
  });
  const theme = useMantineTheme();

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
    setActivePage(1);
    setSelectedGame(null);
    setLoading(true);
    query_games(file, {
      player1: player1 === "" ? undefined : player1,
      rangePlayer1: rangePlayer1,
      player2: player2 === "" ? undefined : player2,
      rangePlayer2: rangePlayer2,
      sides: sides,
      speed: speed === null ? undefined : (speed as Speed),
      outcome: outcome === null ? undefined : (outcome as Outcome),
      limit,
      offset: 0,
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
    speed,
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
      speed: speed === null ? undefined : (speed as Speed),
      outcome: outcome === null ? undefined : (outcome as Outcome),
      limit,
      offset: skip ? 0 : offset,
      skip_count: true,
      sort,
      direction,
    }).then((res) => {
      setLoading(false);
      setGames(res.data);
    });
  }, [offset, sort, direction]);

  const rows =
    games.length === 0 ? (
      <tr>
        <td colSpan={6}>
          <Text weight={500} align="center" p={20}>
            No games found
          </Text>
        </td>
      </tr>
    ) : (
      games.map(([game, white, black], i) => (
        <tr
          key={i}
          onClick={() => {
            i == selectedGame ? setSelectedGame(null) : setSelectedGame(i);
          }}
          className={cx(classes.row, {
            [classes.rowSelected]: i == selectedGame,
          })}
        >
          <td>
            <ActionIcon
              variant="filled"
              color={theme.primaryColor}
              onClick={() => {
                const id = createTab(`${white.name} - ${black.name}`);
                const completeGame: CompleteGame = {
                  game,
                  white,
                  black,
                  currentMove: [],
                };
                sessionStorage.setItem(id, JSON.stringify(completeGame));
                router.push("/boards");
              }}
            >
              <IconEye size={16} stroke={1.5} />
            </ActionIcon>
          </td>
          <td>
            <Group spacing="sm" noWrap>
              <Avatar size={40} src={white.image} radius={40} />
              <div>
                <Text size="sm" weight={500}>
                  {white.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.white_rating}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.outcome}</td>
          {/* <td>{game.outcome.replaceAll("1/2", "½")}</td> */}
          <td>
            <Group spacing="sm" noWrap>
              <Avatar size={40} src={black.image} radius={40} />
              <div>
                <Text size="sm" weight={500}>
                  {black.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.black_rating}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.date}</td>
          <td>
            <SpeeedBadge speed={game.speed} />
          </td>
          <td>{game.site}</td>
        </tr>
      ))
    );

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
                    value={rangePlayer1}
                    onChange={setRangePlayer1}
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
                    value={rangePlayer2}
                    onChange={setRangePlayer2}
                  />
                </Stack>
              </Group>
              <Select
                label="Speed"
                value={speed}
                onChange={setSpeed}
                clearable
                placeholder="Select speed"
                data={[
                  { label: Speed.UltraBullet, value: Speed.UltraBullet },
                  { label: Speed.Bullet, value: Speed.Bullet },
                  { label: Speed.Blitz, value: Speed.Blitz },
                  { label: Speed.Rapid, value: Speed.Rapid },
                  { label: Speed.Classical, value: Speed.Classical },
                  { label: Speed.Correspondence, value: Speed.Correspondence },
                ]}
              />
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
          <Box sx={{ position: "relative" }}>
            <ScrollArea
              h={600}
              viewportRef={viewport}
              onScrollPositionChange={({ y }) => setScrolled(y !== 0)}
              offsetScrollbars
            >
              <Table>
                <thead
                  className={cx(classes.header, {
                    [classes.scrolled]: scrolled,
                  })}
                >
                  <tr>
                    <th />
                    <th>White</th>
                    <th>Result</th>
                    <th>Black</th>
                    <th>Date</th>
                    <th>Speed</th>
                    <th>Site</th>
                  </tr>
                </thead>
                <tbody>
                  <>{rows}</>
                </tbody>
              </Table>
            </ScrollArea>
            <LoadingOverlay visible={loading} />
          </Box>
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
                  {Intl.NumberFormat().format(count)} games
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
