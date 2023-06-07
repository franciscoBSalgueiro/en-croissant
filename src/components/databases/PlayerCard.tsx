import {
  Button,
  ChevronIcon,
  createStyles,
  Divider,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPlayersGameInfo, Player } from "../../utils/db";

const useStyles = createStyles((theme) => ({
  progressLabel: {
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    lineHeight: 1,
    fontSize: theme.fontSizes.sm,
  },
}));

interface PlayerGameInfo {
  won: number;
  lost: number;
  draw: number;
  games_per_month: [string, number][];
  white_openings: [string, number][];
  black_openings: [string, number][];
}

function fillMissingMonths(data: { name: string; games: number }[]) {
  if (data.length === 0) return data;
  const startDate = new Date(data[0].name + "-01");
  const endDate = new Date(data[data.length - 1].name + "-01");
  const months = [];
  const currDate = startDate;

  while (currDate <= endDate) {
    months.push(currDate.toISOString().slice(0, 7));
    currDate.setMonth(currDate.getMonth() + 1);
  }

  const newData = months.map((month) => {
    const foundMonth = data.find((obj) => obj.name === month);
    if (foundMonth) {
      return foundMonth;
    } else {
      return { name: month, games: 0 };
    }
  });

  if (newData.length > 36) {
    // group by year in the same format
    const grouped = newData.reduce((acc, curr) => {
      const year = curr.name.slice(0, 4);
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(curr);
      return acc;
    }, {} as { [key: string]: { name: string; games: number }[] });

    // sum up the games per year
    const summed = Object.entries(grouped).map(([year, months]) => {
      const games = months.reduce((acc, curr) => acc + curr.games, 0);
      return { name: year, games };
    });

    return summed;
  }

  return newData;
}

function PlayerCard({ player, file }: { player: Player; file: string }) {
  const [info, setInfo] = useState<PlayerGameInfo | null>(null);
  const total = info ? info.won + info.lost + info.draw : 0;
  const { classes } = useStyles();
  const [expanded, setExpanded] = useState(false);

  const sections = info
    ? [
      {
        value: (info.won / total) * 100,
        color: "green",
        label: `${((info.won / total) * 100).toFixed(1)}%`,
        tooltip: `${info.won} wins`,
      },
      {
        value: (info.lost / total) * 100,
        color: "red",
        label: `${((info.lost / total) * 100).toFixed(1)}%`,
        tooltip: `${info.lost} losses`,
      },
      {
        value: (info.draw / total) * 100,
        color: "gray",
        label:
          info.draw / total > 0.05
            ? `${((info.draw / total) * 100).toFixed(1)}%`
            : undefined,
        tooltip: `${info.draw} draws`,
      },
    ]
    : [];

  useEffect(() => {
    async function fetchGames() {
      const games = (await getPlayersGameInfo(file, player)) as PlayerGameInfo;
      setInfo(games);
    }
    fetchGames();
  }, [file, player]);

  const data =
    info?.games_per_month
      .map(([month, games]) => ({
        name: month,
        games,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];

  let white_openings = info?.white_openings ?? [];
  let black_openings = info?.black_openings ?? [];

  if (!expanded) {
    white_openings = white_openings.slice(0, 3);
    black_openings = black_openings.slice(0, 3);
  }

  return (
    <Paper shadow="sm" p="sm" withBorder>
      <Stack align="center">
        <Text fz="lg" weight={500}>
          {player.name}
        </Text>
      </Stack>

      <Text align="center">{total} Games</Text>

      <Group grow mt="lg">
        <Stack>
          <Text fw="bold">White</Text>
          {white_openings.map(([opening, games]) => (
            <Text key={opening}>
              {opening}: {games}
            </Text>
          ))}
        </Stack>
        <Stack>
          <Text fw="bold">Black</Text>
          {black_openings.map(([opening, games]) => (
            <Text key={opening}>
              {opening}: {games}
            </Text>
          ))}
        </Stack>
      </Group>
      <Divider
        my="xs"
        variant="dashed"
        labelPosition="center"
        onClick={() => setExpanded((v) => !v)}
        label={
          <Button
            size="sm"
            variant="subtle"
            leftIcon={
              <ChevronIcon
                style={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            }
          >
            {expanded ? "Show Less" : "Show More"}
          </Button>
        }
      />

      <Stack>
        <Progress
          sections={sections}
          size={34}
          classNames={{ label: classes.progressLabel }}
          mt={40}
        />

        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={fillMissingMonths(data)}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />3
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(0, 0, 0)",
              }}
            />
            <Legend />
            <Bar dataKey="games" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Stack>
    </Paper>
  );
}

export default PlayerCard;
