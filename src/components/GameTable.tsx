import {
  Avatar,
  Box,
  Checkbox,
  Group,
  LoadingOverlay,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  Tooltip
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { Chess } from "chess.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, Game, Outcome, query_games, Speed } from "../utils/db";
import BoardView from "./BoardView";
import { SearchInput } from "./SearchInput";
import SpeeedBadge from "./SpeedBadge";

function GameTable({ database }: { database: Database }) {
  const file = database.file;
  const [games, setGames] = useState<Game[]>([]);
  const [count, setCount] = useState(0);
  const [white, setWhite] = useState("");
  const [black, setBlack] = useState("");
  const [speed, setSpeed] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [skip, toggleSkip] = useToggle();
  const [limit, setLimit] = useState(10);
  const [activePage, setActivePage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const offset = (activePage - 1) * limit;

  function fenFromString(moves: string) {
    const chess = new Chess();
    moves.split(" ").map((m) => {
      chess.move(m);
    });
    return chess.fen();
  }

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

  const rows =
    games.length === 0 ? (
      <tr>
        <td colSpan={5}>
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
            game.moves == selectedGame
              ? setSelectedGame(null)
              : setSelectedGame(game.moves);
          }}
        >
          <td>
            <Group spacing="sm">
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
            <Group spacing="sm">
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
          <td>
            <Text lineClamp={1}>{game.moves}</Text>
          </td>
        </tr>
      ))
    );

  return (
    <>
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

      <Box sx={{ position: "relative" }}>
        <Table highlightOnHover>
          <thead>
            <tr>
              <th>White</th>
              <th>Result</th>
              <th>Black</th>
              <th>Date</th>
              <th>Speed</th>
              <th>Link</th>
              <th>Game</th>
            </tr>
          </thead>
          <tbody>
            <>{rows}</>
          </tbody>
        </Table>
        <LoadingOverlay visible={loading} />
      </Box>
      <Select
        label="Results per page"
        value={limit.toString()}
        onChange={(v) => {
          v && setLimit(parseInt(v));
        }}
        sx={{ float: "right" }}
        data={["5", "10", "25", "50", "100"]}
        defaultValue={limit.toString()}
      />
      {!skip && (
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
      )}
      {selectedGame !== null && <BoardView fen={fenFromString(selectedGame)} />}
    </>
  );
}

export default GameTable;
