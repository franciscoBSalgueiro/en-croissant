import {
  Button,
  Divider,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Tooltip as MTTooltip,
  ScrollArea,
  ActionIcon,
  Box,
} from "@mantine/core";
import { useState } from "react";
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
import { PlayerGameInfo } from "@/utils/db";
import { IconChevronDown, IconInfoCircle } from "@tabler/icons-react";
import FideInfo from "../databases/FideInfo";

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

  return newData;
}

function mergeYears(data: { name: string; games: number }[]) {
  // group by year in the same format
  const grouped = data.reduce((acc, curr) => {
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

function PersonalPlayerCard({
  name,
  info,
}: {
  name: string;
  info: PlayerGameInfo;
}) {
  const total = info ? info.won + info.lost + info.draw : 0;
  const [expanded, setExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  let data = fillMissingMonths(
    info?.games_per_month
      .map(([month, games]) => ({
        name: month,
        games,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? []
  );

  if (selectedYear) {
    data = data.filter((obj) => obj.name.startsWith(selectedYear.toString()));
  } else if (data.length > 36) {
    data = mergeYears(data);
  }

  let white_openings = info?.white_openings ?? [];
  let black_openings = info?.black_openings ?? [];

  if (!expanded) {
    white_openings = white_openings.slice(0, 3);
    black_openings = black_openings.slice(0, 3);
  }

  const [opened, setOpened] = useState(false);

  return (
    <Paper
      h="100%"
      shadow="sm"
      p="md"
      withBorder
      style={{ overflow: "hidden" }}
    >
      <FideInfo key={name} opened={opened} setOpened={setOpened} name={name} />
      <ScrollArea h="100%">
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
        <Text ta="center">{total} Games</Text>
        <Progress.Root size="2rem" mt="1rem">
          <MTTooltip label={`${info.won} wins`}>
            <Progress.Section value={(info.won / total) * 100} color="green">
              <Progress.Label>{`${((info.won / total) * 100).toFixed(
                1
              )}%`}</Progress.Label>
            </Progress.Section>
          </MTTooltip>

          <MTTooltip label={`${info.draw} draws`}>
            <Progress.Section value={(info.draw / total) * 100} color="gray">
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
        <Divider my="xs" />
        <Text ta="center" fw="bold">
          Openings
        </Text>
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
              leftSection={
                <IconChevronDown
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
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
      </ScrollArea>
    </Paper>
  );
}

export default PersonalPlayerCard;
