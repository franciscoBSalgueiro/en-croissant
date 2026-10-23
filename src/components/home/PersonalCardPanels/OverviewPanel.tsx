import { Box, Divider, Group, Select, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { PlayerGameInfo, StatsData } from "@/bindings";
import { getTimeControl } from "@/utils/timeControl";
import ResultsChart from "./ResultsChart";
import TimeControlSelector from "./TimeControlSelector";
import WebsiteAccountSelector from "./WebsiteAccountSelector";
import classes from "../PersonalCard.module.css";

type ActivityData = { name: string; count: number; won: number; draw: number; lost: number };

function fillMissingMonths(data: ActivityData[]): ActivityData[] {
  if (data.length === 0) return data;

  data = [...data].sort((a, b) => a.name.localeCompare(b.name));

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

  const dataMap = new Map(data.map((item) => [item.name, item]));
  const filledData = monthStrings.map((month) => {
    const item = dataMap.get(month);
    return item ?? { name: month, count: 0, won: 0, draw: 0, lost: 0 };
  });

  return filledData;
}

function mergeYears(data: ActivityData[]): ActivityData[] {
  const yearCounts: { [year: string]: ActivityData } = {};

  for (const { name, count, won, draw, lost } of data) {
    const year = name.slice(0, 4);
    const previous = yearCounts[year] ?? { name: year, count: 0, won: 0, draw: 0, lost: 0 };
    yearCounts[year] = {
      name: year,
      count: previous.count + count,
      won: previous.won + won,
      draw: previous.draw + draw,
      lost: previous.lost + lost,
    };
  }

  return Object.values(yearCounts);
}

function extractGameStats(games: StatsData[]) {
  const total = games.length;
  const won = games.filter((d) => d.result === "Won").length;
  const draw = games.filter((d) => d.result === "Drawn").length;
  const lost = games.filter((d) => d.result === "Lost").length;

  const monthCounts: { [key: string]: ActivityData } = {};
  for (const game of games) {
    const monthString = game.date.slice(0, 7).replace(".", "-");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthString)) continue;
    const row = monthCounts[monthString] ?? {
      name: monthString,
      count: 0,
      won: 0,
      draw: 0,
      lost: 0,
    };
    row.count++;
    row[game.result === "Won" ? "won" : game.result === "Drawn" ? "draw" : "lost"]++;
    monthCounts[monthString] = row;
  }

  const dataPerMonth = Object.values(monthCounts);

  return { total, won, draw, lost, dataPerMonth };
}

function OverviewPanel({
  playerName,
  info,
  isDatabase,
}: {
  playerName: string;
  info: PlayerGameInfo;
  isDatabase?: boolean;
}) {
  const { t, i18n } = useTranslation();
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
          getTimeControl(website, game.time_control) === timeControl,
      ) ?? [];
  const { total, won, draw, lost, dataPerMonth } = extractGameStats(games);

  return (
    <Stack gap="sm" className={classes.overview}>
      {!isDatabase && (
        <Group grow>
          <WebsiteAccountSelector
            playerName={playerName}
            onWebsiteChange={(website) => setWebsite(website)}
            onAccountChange={setAccount}
            allowAll={true}
          />
        </Group>
      )}
      <Group justify="space-between" gap="sm">
        <Text fw={500} size="sm">
          {t("Home.Personal.GameCount", {
            count: total,
            formattedCount: total.toLocaleString(i18n.resolvedLanguage),
          })}
        </Text>
        <Group gap="xs">
          <Text c="dimmed" size="sm">
            {t("Board.Database.TimeControl")}
          </Text>
          <Box w={150}>
            <TimeControlSelector
              website={website}
              onTimeControlChange={setTimeControl}
              allowAll={true}
              showLabel={false}
            />
          </Box>
        </Group>
      </Group>

      {total > 0 && (
        <>
          <Stack gap="xs">
            <Text c="dimmed" size="xs">
              {t("Board.Practice.Build.Results")}
            </Text>
            <ResultsChart won={won} draw={draw} lost={lost} size="1rem" />
            <div className={classes.overviewLegend}>
              {[
                {
                  label: t("Home.Personal.Wins"),
                  count: won,
                  color: "var(--mantine-color-teal-5)",
                },
                {
                  label: t("Home.Personal.Draws"),
                  count: draw,
                  color: "var(--mantine-color-gray-6)",
                },
                {
                  label: t("Home.Personal.Losses"),
                  count: lost,
                  color: "var(--mantine-color-red-4)",
                },
              ].map((result) => (
                <Group key={result.label} gap={6} wrap="nowrap">
                  <span className={classes.dot} style={{ background: result.color }} />
                  <Text size="sm" c="dimmed">
                    {result.label}
                  </Text>
                  <Text size="sm" fw={500}>
                    {result.count.toLocaleString(i18n.resolvedLanguage)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {((result.count / total) * 100).toFixed(0)}%
                  </Text>
                </Group>
              ))}
            </div>
          </Stack>
          <Divider />
          <DateChart key={playerName} dataPerMonth={dataPerMonth} />
        </>
      )}
      {total === 0 && (
        <Text c="dimmed" size="sm" py="lg" ta="center">
          {t("Home.Personal.NoGames")}
        </Text>
      )}
    </Stack>
  );
}

const DateChartTooltip = ({
  active,
  payload,
  label,
  isYearSelected,
}: TooltipContentProps<ValueType, NameType> & { isYearSelected: boolean }) => {
  const { t } = useTranslation();
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "var(--mantine-color-body)",
          boxShadow: "var(--mantine-shadow-md)",
          borderRadius: "var(--mantine-radius-default)",
          border: "calc(0.0625rem* var(--mantine-scale)) solid var(--mantine-color-default-border)",
          padding: "10px",
        }}
      >
        <p style={{ margin: "0" }}>{`${label}`}</p>
        {payload.map((item) => (
          <p
            key={String(item.dataKey)}
            style={{ color: item.color, margin: "4px 0" }}
          >{`${item.name}: ${item.value}`}</p>
        ))}
        <p style={{ fontSize: "0.75rem", margin: "0", color: "grey" }}>
          {isYearSelected ? t("Home.Personal.ExpandYear") : t("Home.Personal.ReturnToYears")}
        </p>
      </div>
    );
  }

  return null;
};

function DateChart({ dataPerMonth }: { dataPerMonth: ActivityData[] }) {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  let data = fillMissingMonths(dataPerMonth);

  if (selectedYear) {
    data = data.filter((obj) => obj.name.startsWith(selectedYear.toString()));
  } else if (data.length > 36) {
    data = mergeYears(data);
  }

  const years = [...new Set(dataPerMonth.map((row) => row.name.slice(0, 4)))].sort();
  return (
    <Stack gap="sm" className={classes.activity}>
      <Group justify="space-between">
        <div>
          <Text fw={500}>{t("Home.Personal.Activity")}</Text>
          <Text c="dimmed" size="xs">
            {selectedYear || (data.length <= 36 && data[0]?.name.length > 4)
              ? t("Home.Personal.GamesPerMonth")
              : t("Home.Personal.GamesPerYear")}
          </Text>
        </div>
        <Select
          w={140}
          value={selectedYear ? String(selectedYear) : "all"}
          data={[{ value: "all", label: t("Home.Personal.AllYears") }, ...years]}
          aria-label={t("Home.Personal.Activity")}
          allowDeselect={false}
          onChange={(value) => setSelectedYear(value && value !== "all" ? Number(value) : null)}
        />
      </Group>
      <Box className={classes.activityPlot}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
            onClick={(e) => {
              const year = Number.parseInt(e.activeLabel?.toString() ?? "", 10);
              if (year) {
                setSelectedYear((prev) => (prev === year ? null : year));
              }
            }}
          >
            <CartesianGrid stroke="var(--mantine-color-default-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              content={(props) => (
                <DateChartTooltip {...props} isYearSelected={selectedYear === null} />
              )}
              cursor={{
                fill: "var(--mantine-color-default-border)",
                stroke: "1px solid var(--chart-grid-color)",
              }}
            />
            <Bar
              dataKey="won"
              stackId="results"
              fill="var(--mantine-color-teal-5)"
              name={t("Home.Personal.Wins")}
            />
            <Bar
              dataKey="draw"
              stackId="results"
              fill="var(--mantine-color-gray-6)"
              name={t("Home.Personal.Draws")}
            />
            <Bar
              dataKey="lost"
              stackId="results"
              fill="var(--mantine-color-red-4)"
              name={t("Home.Personal.Losses")}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
}

export default OverviewPanel;
