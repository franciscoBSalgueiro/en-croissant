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
  Group,
  Divider,
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
import VirtualizedScrollArea from "../common/VirtualizedScrollArea";

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

  const whiteGames = white_openings.reduce((acc, cur) => {
    return acc + cur[1].won + cur[1].draw + cur[1].lost;
  }, 0);
  const blackGames = black_openings.reduce((acc, cur) => {
    return acc + cur[1].won + cur[1].draw + cur[1].lost;
  }, 0);

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
          <MTTooltip label="FIDE info">
            <ActionIcon
              pos="absolute"
              right={0}
              onClick={() => setOpened(true)}
            >
              <IconInfoCircle />
            </ActionIcon>
          </MTTooltip>
        )}
        <Stack align="center" w="100%">
          <Text fz="lg" fw={500}>
            {name}
          </Text>
        </Stack>
      </Box>
      <Tabs
        keepMounted={false}
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
            <Text pt="md" fw="bold" fz="lg" ta="center">
              {total} Games
            </Text>

            {total > 0 && (
              <>
                <ResultsChart
                  won={info.won}
                  draw={info.draw}
                  lost={info.lost}
                  size="2rem"
                />

                <DateChart data_per_month={info.data_per_month} />
              </>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel
          value="openings"
          style={{ overflow: "hidden", flex: 1 }}
          py="md"
        >
          <Group grow>
            <Text ta="center" fw="bold">White</Text>
            <Text ta="center" fw="bold">Black</Text>
          </Group>
          <Divider mt="md" />
          <VirtualizedScrollArea
            itemCount={Math.max(white_openings.length, black_openings.length)}
            itemSize={120}
          >
            {({ index, style }) => {
              const white = white_openings[index];
              const black = black_openings[index];
              return (
                <Stack key={white?.[0] ?? black?.[0]} style={style} gap={0}>
                  <Group grow h="100%">
                    {white ? (
                      <Stack
                        style={{ overflow: "hidden" }}
                        h="100%"
                        py="sm"
                        justify="space-between"
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Text lineClamp={2}>{white[0]}</Text>
                          <Text>
                            {(
                              ((white[1].won + white[1].draw + white[1].lost) /
                                whiteGames) *
                              100
                            ).toFixed(2)}
                            %
                          </Text>
                        </Group>
                        <ResultsChart
                          won={white[1].won}
                          draw={white[1].draw}
                          lost={white[1].lost}
                          size="1.5rem"
                        />
                      </Stack>
                    ) : (
                      <div />
                    )}
                    {black ? (
                      <Stack
                        style={{ overflow: "hidden" }}
                        h="100%"
                        py="sm"
                        justify="space-between"
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Text lineClamp={2}>{black[0]}</Text>
                          <Text>
                            {(
                              ((black[1].won + black[1].draw + black[1].lost) /
                                blackGames) *
                              100
                            ).toFixed(2)}
                            %
                          </Text>
                        </Group>
                        <ResultsChart
                          won={black[1].won}
                          draw={black[1].draw}
                          lost={black[1].lost}
                          size="1.5rem"
                        />
                      </Stack>
                    ) : (
                      <div />
                    )}
                  </Group>
                  <Divider />
                </Stack>
              );
            }}
          </VirtualizedScrollArea>
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
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={["dataMin - 50", "dataMax + 50"]}
        />
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

function ResultsChart({
  won,
  draw,
  lost,
  size,
}: {
  won: number;
  draw: number;
  lost: number;
  size: string;
}) {
  const total = won + draw + lost;
  return (
    <Progress.Root size={size}>
      <MTTooltip label={`${won} wins`}>
        <Progress.Section value={(won / total) * 100} color="green">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {won / total > 0.15
              ? `${((won / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={`${draw} draws`}>
        <Progress.Section value={(draw / total) * 100} color="gray">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {draw / total > 0.15
              ? `${((draw / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={`${lost} losses`}>
        <Progress.Section value={(lost / total) * 100} color="red">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {lost / total > 0.15
              ? `${((lost / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>
    </Progress.Root>
  );
}

export default PersonalPlayerCard;
