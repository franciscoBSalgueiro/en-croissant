import { Box, Center, Divider, Group, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import type { PlayerGameInfo } from "@/bindings";
import { getTimeControl } from "@/utils/timeControl";
import {
  getRatingDateBounds,
  getRatingRangeIndices,
  type RatingDateBounds,
} from "@/utils/ratingRange";
import { useTranslation } from "react-i18next";
import DateRangeTabs, { DateRange } from "./DateRangeTabs";
import { tooltipContentStyle, tooltipCursorStyle } from "./RatingsPanel.styles";
import classes from "../PersonalCard.module.css";
import TimeControlSelector from "./TimeControlSelector";
import TimeRangeSlider from "./TimeRangeSlider";
import WebsiteAccountSelector from "./WebsiteAccountSelector";

function RatingsPanel({
  playerName,
  info,
  isDatabase,
}: {
  playerName: string;
  info: PlayerGameInfo;
  isDatabase?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const formatDate = (date: number, options: Intl.DateTimeFormatOptions) =>
    new Date(date).toLocaleDateString(i18n.resolvedLanguage, options);
  const [dateRange, setDateRange] = useState<string | null>(DateRange.AllTime);
  const [timeControl, setTimeControl] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>("All accounts");
  const [customTimeRange, setTimeRange] = useState<RatingDateBounds | null>(null);

  const dates = useMemo(() => {
    return Array.from(
      new Set([
        ...info.site_stats_data
          .filter((games) => !website || games.site === website)
          .filter((games) => account === "All accounts" || games.player === account)
          .flatMap((games) => games.data)
          .filter(
            (game) =>
              game.player_elo > 0 &&
              (!timeControl ||
                timeControl === "any" ||
                getTimeControl(website, game.time_control) === timeControl),
          )
          .map((game) => dayjs(game.date, "YYYY-MM-DD", true).valueOf())
          .filter(Number.isFinite),
      ]),
    ).sort((a, b) => a - b);
  }, [info.site_stats_data, website, account, timeControl]);

  const { start: rangeStart, end: rangeEnd } = getRatingDateBounds(
    dateRange,
    dates,
    customTimeRange,
  );
  const timeRange = getRatingRangeIndices(dates, { start: rangeStart, end: rangeEnd });
  const ratingData = useMemo(() => {
    const filteredGames =
      info.site_stats_data
        .filter((games) => !website || games.site === website)
        .filter((games) => account === "All accounts" || games.player === account)
        .flatMap((games) => games.data)
        .filter(
          (game) =>
            game.player_elo > 0 &&
            (!timeControl ||
              timeControl === "any" ||
              getTimeControl(website!, game.time_control) === timeControl),
        )
        .filter((game) => {
          const gameDate = dayjs(game.date, "YYYY-MM-DD", true).valueOf();
          return gameDate >= rangeStart && gameDate <= rangeEnd;
        }) ?? [];

    const ratingData = (() => {
      const map = new Map<number, { date: number; player_elo: number }>();
      for (const game of filteredGames) {
        const date = dayjs(game.date, "YYYY-MM-DD", true).valueOf();
        if (!map.has(date) || map.get(date)!.player_elo < game.player_elo) {
          map.set(date, { date, player_elo: game.player_elo });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.date - b.date);
    })();

    return ratingData;
  }, [info.site_stats_data, website, account, timeControl, rangeStart, rangeEnd]);

  const first = ratingData[0];
  const last = ratingData.at(-1);
  const peak = ratingData.reduce((max, point) => Math.max(max, point.player_elo), 0);
  const change = first && last ? last.player_elo - first.player_elo : 0;
  const chartData = ratingData.flatMap((point, index) =>
    index > 0 && point.date - ratingData[index - 1].date > 183 * 86400000
      ? [{ date: point.date - 1, player_elo: null }, point]
      : [point],
  );

  const playerEloDomain =
    ratingData.length === 0
      ? null
      : ratingData.reduce(
          ([min, max], { player_elo }) => [
            Math.floor(Math.min(min, player_elo) / 50) * 50,
            Math.ceil(Math.max(max, player_elo) / 50) * 50,
          ],
          [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
        );

  return (
    <Stack gap="sm" className={classes.ratings}>
      {!isDatabase && (
        <Group grow>
          <WebsiteAccountSelector
            playerName={playerName}
            onWebsiteChange={setWebsite}
            onAccountChange={setAccount}
            allowAll={false}
          />
          <TimeControlSelector
            onTimeControlChange={setTimeControl}
            website={website}
            allowAll={false}
          />
        </Group>
      )}
      <Stack gap="xs">
        <Group justify="space-between" gap="xs">
          <DateRangeTabs timeRange={dateRange} onTimeRangeChange={setDateRange} />
          {first && last && (
            <Text c="dimmed" size="xs">
              {formatDate(rangeStart, { month: "short", day: "numeric", year: "numeric" })} –{" "}
              {formatDate(rangeEnd, { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          )}
        </Group>
        {dates.length > 1 && timeRange && (
          <TimeRangeSlider
            ratingDates={dates}
            dateRange={timeRange}
            onDateRangeChange={(range) => {
              setDateRange(null);
              setTimeRange({ start: dates[range.start], end: dates[range.end] });
            }}
          />
        )}
      </Stack>

      <Divider />
      <Group justify="space-between" gap="sm">
        <Text fw={500} size="sm">
          {t("Home.Personal.RatingHistory")}
        </Text>
        <Group gap="md" className={classes.ratingsSummary}>
          {[
            {
              label: t("Home.Personal.Latest"),
              value: last ? String(last.player_elo) : "—",
            },
            {
              label: t("Home.Personal.Highest"),
              value: last ? String(peak) : "—",
            },
            {
              label: t("Home.Personal.Change"),
              value: last ? `${change >= 0 ? "+" : ""}${change}` : "—",
            },
          ].map((metric) => (
            <Group key={metric.label} gap={6}>
              <Text c="dimmed" size="sm">
                {metric.label}
              </Text>
              <Text size="sm" fw={600}>
                {metric.value}
              </Text>
            </Group>
          ))}
        </Group>
      </Group>
      {ratingData.length > 0 && (
        <>
          <Box className={classes.ratingsChart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid
                  stroke="var(--mantine-color-default-border)"
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  domain={
                    rangeStart === rangeEnd
                      ? [rangeStart - 86400000, rangeEnd + 86400000]
                      : [rangeStart, rangeEnd]
                  }
                  tickFormatter={(date) =>
                    formatDate(
                      date,
                      first && last && last.date - first.date < 90 * 86400000
                        ? { month: "short", day: "numeric" }
                        : { month: "short", year: "numeric" },
                    )
                  }
                  ticks={first?.date === last?.date ? [first.date] : undefined}
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={70}
                  tick={{ fontSize: 11 }}
                  tickMargin={8}
                />
                <YAxis
                  domain={playerEloDomain ?? undefined}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  cursor={tooltipCursorStyle}
                  labelFormatter={(label) =>
                    formatDate(Number(label), { month: "short", day: "numeric", year: "numeric" })
                  }
                />
                <Line
                  name={t("Home.Personal.Rating")}
                  dataKey="player_elo"
                  stroke="var(--mantine-primary-color-4)"
                  strokeWidth={1.5}
                  strokeOpacity={0.9}
                  dot={ratingData.length === 1 ? { r: 4 } : false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Text c="dimmed" size="xs">
            {t("Home.Personal.RatingDates", {
              count: ratingData.length,
              formattedCount: ratingData.length.toLocaleString(i18n.resolvedLanguage),
            })}
          </Text>
        </>
      )}
      {ratingData.length === 0 && (
        <Center className={classes.ratingsChart}>
          <Text c="dimmed" size="sm">
            {t("Home.Personal.NoRatings")}
          </Text>
        </Center>
      )}
    </Stack>
  );
}

export default RatingsPanel;
