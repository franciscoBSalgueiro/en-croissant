import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Collapse,
  createStyles,
  Grid,
  Group,
  LoadingOverlay,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip
} from "@mantine/core";
import { useDebouncedValue, useHotkeys, useToggle } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, Game, Outcome, query_games, Speed } from "../utils/db";
import BoardView from "./BoardView";
import { SearchInput } from "./SearchInput";
import SpeeedBadge from "./SpeedBadge";

const useStyles = createStyles((theme) => ({
  titleInput: {
    input: {
      fontSize: 34,
      fontWeight: "bold",
    },
  },

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

function GameTable({ database }: { database: Database }) {
  const { classes, cx } = useStyles();
  const file = database.file;
  const [games, setGames] = useState<Game[]>([]);
  const [count, setCount] = useState(0);
  const [white, setWhite] = useState("");
  const [black, setBlack] = useState("");
  const [speed, setSpeed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skip, toggleSkip] = useToggle();
  const [limit, setLimit] = useState(25);
  const [activePage, setActivePage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const offset = (activePage - 1) * limit;
  const [scrolled, setScrolled] = useState(false);
  const [title, setTitle] = useState(database.title);
  const [debouncedTitle] = useDebouncedValue(title, 200);
  const [openedSettings, toggleOpenedSettings] = useToggle();

  useEffect(() => {
    setActivePage(1);
    setSelectedGame(null);
    setLoading(true);
    query_games(file, {
      white: white === "" ? undefined : white,
      black: black === "" ? undefined : black,
      speed: speed === null ? undefined : (speed as Speed),
      outcome: outcome === null ? undefined : (outcome as Outcome),
      limit,
      offset: 0,
      skip_count: skip,
    }).then((res) => {
      setLoading(false);
      setGames(res.data);
      setCount(res.count);
    });
  }, [white, black, speed, outcome, skip, limit, file]);

  useEffect(() => {
    setLoading(true);
    setSelectedGame(null);
    query_games(file, {
      white: white === "" ? undefined : white,
      black: black === "" ? undefined : black,
      speed: speed === null ? undefined : (speed as Speed),
      outcome: outcome === null ? undefined : (outcome as Outcome),
      limit,
      offset: skip ? 0 : offset,
      skip_count: skip,
    }).then((res) => {
      setLoading(false);
      setGames(res.data);
      setCount(res.count);
    });
  }, [offset]);

  useEffect(() => {
    invoke("rename_db", {
      file: database.file,
      name: debouncedTitle,
    });
  }, [debouncedTitle]);

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
      games.map((game, i) => (
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
            <Group spacing="sm" noWrap>
              <Avatar size={40} src={game.white.image} radius={40} />
              <div>
                <Text size="sm" weight={500}>
                  {game.white.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.white.rating}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.outcome.replaceAll("1/2", "½")}</td>
          <td>
            <Group spacing="sm" noWrap>
              <Avatar size={40} src={game.black.image} radius={40} />
              <div>
                <Text size="sm" weight={500}>
                  {game.black.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {game.black.rating}
                </Text>
              </div>
            </Group>
          </td>
          <td>{game.date}</td>
          <td>
            <SpeeedBadge speed={game.speed} />
          </td>
          <td>
            {game.site && (
              <Link href={"https://lichess.org/" + game.site} target="_blank">
                {game.site}
              </Link>
            )}
          </td>
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
      <TextInput
        variant="unstyled"
        m={30}
        size="xl"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        className={classes.titleInput}
        error={title === "" && "Name is required"}
      />
      <Grid grow>
        <Grid.Col span={3}>
          <Box sx={{ position: "relative" }}>
            <ScrollArea
              h={600}
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
                    <th>White</th>
                    <th>Result</th>
                    <th>Black</th>
                    <th>Date</th>
                    <th>Speed</th>
                    <th>Link</th>
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
              <Stack align="center" spacing={0} mt={20}>
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
          <Box my={15}>
            <Button
              compact
              variant="outline"
              leftIcon={<IconSearch size={15} />}
              onClick={() => toggleOpenedSettings()}
            >
              Search Settings
            </Button>
          </Box>
          <Collapse in={openedSettings}>
            <Stack>
              <Group grow>
                <SearchInput
                  value={white}
                  setValue={setWhite}
                  label="White"
                  file={file}
                />
                <SearchInput
                  value={black}
                  setValue={setBlack}
                  label="Black"
                  file={file}
                />
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
          {selectedGame !== null && (
            <>
              <Stack>
                <Group align="apart" grow>
                  <Stack align="center" spacing={0}>
                    <Avatar src={games[selectedGame].white.image} />
                    <Text weight={500} align="right">
                      {games[selectedGame].white.name}
                    </Text>
                  </Stack>
                  <Stack align="center" spacing={0}>
                    <Text>
                      {games[selectedGame].outcome.replaceAll("1/2", "½")}
                    </Text>
                    <Text c="dimmed">{games[selectedGame].date}</Text>
                  </Stack>
                  <Stack align="center" spacing={0}>
                    <Avatar src={games[selectedGame].white.image} />
                    <Text weight={500} align="left">
                      {games[selectedGame].black.name}
                    </Text>
                  </Stack>
                </Group>
                <BoardView pgn={games[selectedGame].moves} />
              </Stack>
            </>
          )}
        </Grid.Col>
      </Grid>
    </>
  );
}

export default GameTable;
