import type { PlayerGameInfo } from "@/bindings";
import type { StatsData } from "@/bindings";
import { getTimeControl } from "@/utils/timeControl";
import {
  Stack,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import ResultsChart from "./ResultsChart";
import TimeControlSelector from "./TimeControlSelector";
import WebsiteAccountSelector from "./WebsiteAccountSelector";

function fillMissingMonths(
  data: { name: string; count: number }[],
): { name: string; count: number }[] {
  if (data.length === 0) return data;

  data.sort((a, b) => a.name.localeCompare(b.name));

  const monthStrings: string[] = [];
  const startDate = new Date(`${data[0].name}-01`);
  const endDate = new Date(`${data[data.length - 1].name}-01`);

  const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000; // milliseconds
  const currDate = new Date(startDate);
  while (currDate <= endDate) {
    const localCurrDate = new Date(currDate.getTime() - timezoneOffset);
    const monthString = localCurrDate.toISOString().slice(0, 7);
    monthStrings.push(monthString);
    currDate.setMonth(currDate.getMonth() + 1);
  }

  const dataMap = new Map(data.map((item) => [item.name, item.count]));
  const filledData = monthStrings.map((month) => ({
    name: month,
    count: dataMap.get(month) || 0,
  }));

  return filledData;
}

function mergeYears(
  data: { name: string; count: number }[],
): { name: string; count: number }[] {
  const yearCounts: { [year: string]: number } = {};

  for (const { name, count } of data) {
    const year = name.slice(0, 4);
    yearCounts[year] = (yearCounts[year] || 0) + count;
  }

  return Object.entries(yearCounts).map(([year, count]) => ({
    name: year,
    count,
  }));
}

function extractGameStats(games: StatsData[]) {
  const total = games.length;
  const won = games.filter((d) => d.result === "Won").length;
  const draw = games.filter((d) => d.result === "Drawn").length;
  const lost = games.filter((d) => d.result === "Lost").length;

  const monthCounts: { [key: string]: number } = {};
  for (const game of games) {
    const monthString = game.date.slice(0, 7).replace(".", "-");
    monthCounts[monthString] = (monthCounts[monthString] || 0) + 1;
  }

  const dataPerMonth = Object.entries(monthCounts).map(([month, count]) => ({
    name: month,
    count,
  }));

  return { total, won, draw, lost, dataPerMonth };
}

function OverviewPanel({
  playerName,
  info,
}: {
  playerName: string;
  info: PlayerGameInfo;
}) {
  const [website, setWebsite] = useState<string | null>("All websites");
  const [account, setAccount] = useState<string | null>("All accounts");
  const [timeControl, setTimeControl] = useState<string | null>(null);

  const games =
    info?.site_stats_data
      .filter((d) => website === "All websites" || d.site === website)
      .filter((d) => account === "All accounts" || d.player === account)
      .flatMap((d) => d.data)
      .filter(
        (game) =>
          !timeControl ||
          timeControl === "any" ||
          getTimeControl(website!, game.time_control) === timeControl,
      ) ?? [];
  const { total, won, draw, lost, dataPerMonth } = extractGameStats(games);

  return (
    <Stack>
      <WebsiteAccountSelector
        playerName={playerName}
        onWebsiteChange={(website) => {
          setWebsite(website);
          if (website === "All websites") {
            setTimeControl(null);
          } else if (timeControl === null) {
            setTimeControl("any");
          }
        }}
        onAccountChange={setAccount}
        allowAll={true}
      />
      {website !== "All websites" && (
        <TimeControlSelector
          website={website}
          onTimeControlChange={setTimeControl}
          allowAll={true}
        />
      )}

      <Text pt="md" fw="bold" fz="lg" ta="center">
        {total} Games
      </Text>

      {total > 0 && (
        <>
          <ResultsChart won={won} draw={draw} lost={lost} size="2rem" />
          <DateChart dataPerMonth={dataPerMonth} />
        </>
      )}
    </Stack>
  );
}

const DateChartTooltip = ({
  active,
  payload,
  label,
  isYearSelected,
}: TooltipProps<ValueType, NameType> & { isYearSelected: boolean }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "var(--mantine-color-body)",
          boxShadow: "var(--mantine-shadow-md)",
          borderRadius: "var(--mantine-radius-default)",
          border:
            "calc(0.0625rem* var(--mantine-scale)) solid var(--mantine-color-default-border)",
          padding: "10px",
        }}
      >
        <p style={{ margin: "0" }}>{`${label}`}</p>
        <p
          style={{
            color: "var(--mantine-color-blue-filled)",
            marginTop: "8px",
          }}
        >{`${payload?.[0].name} : ${payload?.[0].value}`}</p>
        <p style={{ fontSize: "0.75rem", margin: "0", color: "grey" }}>
          Click to{" "}
          {isYearSelected
            ? "see the month details"
            : "return to the years view"}
          .
        </p>
      </div>
    );
  }

  return null;
};

function DateChart({
  dataPerMonth,
}: {
  dataPerMonth: { name: string; count: number }[];
}) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  let data = fillMissingMonths(dataPerMonth);

  if (selectedYear) {
    data = data.filter((obj) => obj.name.startsWith(selectedYear.toString()));
  } else if (data.length > 36) {
    data = mergeYears(data);
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        onClick={(e) => {
          const year = Number.parseInt(e.activePayload?.[0]?.payload?.name);
          if (year) {
            setSelectedYear((prev) => (prev === year ? null : year));
          }
        }}
      >
        <CartesianGrid strokeDasharray="3" vertical={false} />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip
          content={<DateChartTooltip isYearSelected={selectedYear === null} />}
          cursor={{
            fill: "var(--mantine-color-default-border)",
            stroke: "1px solid var(--chart-grid-color)",
          }}
        />
        <Bar
          dataKey="count"
          fill="var(--mantine-color-blue-filled)"
          name="Games"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default OverviewPanel;
