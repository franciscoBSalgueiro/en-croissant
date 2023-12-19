import {
  Paper,
  Progress,
  Stack,
  Text,
  Tooltip as MTTooltip,
  ActionIcon,
  Box,
  Tabs,
  useMantineTheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PlayerGameInfo } from "@/utils/db";
import { IconInfoCircle } from "@tabler/icons-react";
import FideInfo from "../databases/FideInfo";
import { DataTable } from "mantine-datatable";
import { MonthData } from "@/bindings";

function fillMissingMonths(
  data: { name: string; data: MonthData }[]
): { name: string; data: { count: number; avg_elo: number | null } }[] {
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
      return { name: month, data: { count: 0, avg_elo: null } };
    }
  });

  return newData;
}

function mergeYears(
  data: { name: string; data: { count: number; avg_elo: number | null } }[]
) {
  // group by year in the same format
  const grouped = data.reduce((acc, curr) => {
    const year = curr.name.slice(0, 4);
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(curr);
    return acc;
  }, {} as { [key: string]: { name: string; data: { count: number; avg_elo: number | null } }[] });

  // sum up the games per year
  const summed = Object.entries(grouped).map(([year, months]) => {
    const games = months.reduce((acc, curr) => acc + curr.data.count, 0);
    const avg_elo =
      months.filter((obj) => obj.data.avg_elo !== null).length > 0
        ? months.reduce((acc, curr) => acc + curr.data.avg_elo!, 0) /
          months.filter((obj) => obj.data.avg_elo !== null).length
        : null;
    return { name: year, data: { count: games, avg_elo } };
  });

  return summed;
}

function zip<T>(a: T[], b: T[]) {
  return Array.from(Array(Math.max(b.length, a.length)), (_, i) => [
    a[i],
    b[i],
  ]);
}

function PersonalPlayerCard({
  name,
  info,
}: {
  name: string;
  info: PlayerGameInfo;
}) {
  const total = info ? info.won + info.lost + info.draw : 0;

  const white_openings = info?.white_openings ?? [];
  const black_openings = info?.black_openings ?? [];

  const [opened, setOpened] = useState(false);

  return (
    <Paper
      h="100%"
      shadow="sm"
      p="md"
      withBorder
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <FideInfo key={name} opened={opened} setOpened={setOpened} name={name} />
      <Box pos="relative">
        {name !== "Stats" && (
          <ActionIcon pos="absolute" onClick={() => setOpened(true)}>
            <IconInfoCircle />
          </ActionIcon>
        )}
        <Stack align="center" w="100%">
          <Text fz="lg" fw={500}>
            {name}
          </Text>
        </Stack>
      </Box>
      <Tabs
        defaultValue="overview"
        variant="outline"
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="openings">Openings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Stack>
            <Text pt="md" ta="center">
              {total} Games
            </Text>
            <Progress.Root size="2rem" mt="1rem">
              <MTTooltip label={`${info.won} wins`}>
                <Progress.Section
                  value={(info.won / total) * 100}
                  color="green"
                >
                  <Progress.Label>{`${((info.won / total) * 100).toFixed(
                    1
                  )}%`}</Progress.Label>
                </Progress.Section>
              </MTTooltip>

              <MTTooltip label={`${info.draw} draws`}>
                <Progress.Section
                  value={(info.draw / total) * 100}
                  color="gray"
                >
                  <Progress.Label>
                    {info.draw / total > 0.1
                      ? `${((info.draw / total) * 100).toFixed(1)}%`
                      : undefined}
                  </Progress.Label>
                </Progress.Section>
              </MTTooltip>

              <MTTooltip label={`${info.lost} losses`}>
                <Progress.Section value={(info.lost / total) * 100} color="red">
                  <Progress.Label>{`${((info.lost / total) * 100).toFixed(
                    1
                  )}%`}</Progress.Label>
                </Progress.Section>
              </MTTooltip>
            </Progress.Root>

            <DateChart data_per_month={info.data_per_month} />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="openings" style={{ overflow: "hidden" }}>
          <DataTable
            columns={[
              {
                accessor: "white",
                title: "White",
                render: ({ white }) => <Text>{white}</Text>,
              },
              {
                accessor: "white_games",
                title: "#",
                textAlign: "right",
                render: ({ white_games }) => <Text>{white_games}</Text>,
              },
              {
                accessor: "black",
                title: "Black",
                render: ({ black }) => <Text>{black}</Text>,
              },
              {
                accessor: "black_games",
                title: "#",
                textAlign: "right",
                render: ({ black_games }) => <Text>{black_games}</Text>,
              },
            ]}
            records={zip(white_openings, black_openings).map(
              ([white, black]) => ({
                white: white && white[0],
                white_games: white && white[1],
                black: black && black[0],
                black_games: black && black[1],
              })
            )}
          />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}

function DateChart({
  data_per_month,
}: {
  data_per_month: [string, MonthData][];
}) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  let data = fillMissingMonths(
    data_per_month
      .map(([month, data]) => ({
        name: month,
        data,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? []
  );

  if (selectedYear) {
    data = data.filter((obj) => obj.name.startsWith(selectedYear.toString()));
  } else if (data.length > 36) {
    data = mergeYears(data);
  }
  data = data.map((obj) => ({
    name: obj.name,
    data: {
      count: obj.data.count,
      avg_elo: obj.data.avg_elo ? Math.round(obj.data.avg_elo) : null,
    },
  }));

  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
        onClick={(e) => {
          const year = parseInt(e.activePayload?.[0]?.payload?.name);
          if (year) {
            setSelectedYear((prev) => (prev === year ? null : year));
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />3
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip
          contentStyle={{
            backgroundColor:
              colorScheme === "dark"
                ? theme.colors.dark[7]
                : theme.colors.gray[0],
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="data.count" fill="#8884d8" name="Games" />
        <Line
          yAxisId="right"
          dataKey="data.avg_elo"
          stroke="#82ca9d"
          name="Average ELO"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default PersonalPlayerCard;
