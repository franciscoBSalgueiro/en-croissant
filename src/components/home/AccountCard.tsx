import { events, commands } from "@/bindings";
import type { DatabaseInfo } from "@/bindings";
import { downloadChessCom } from "@/utils/chess.com/api";
import { getDatabases, query_games } from "@/utils/db";
import { capitalize } from "@/utils/format";
import { downloadLichess } from "@/utils/lichess/api";
import { unwrap } from "@/utils/unwrap";
import {
  Accordion,
  ActionIcon,
  Card,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconDownload,
  IconRefresh,
  IconX,
  type TablerIconsProps,
} from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { info } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import LichessLogo from "./LichessLogo";
import * as classes from "./styles.css";

interface AccountCardProps {
  type: "lichess" | "chesscom";
  database: DatabaseInfo | null;
  title: string;
  updatedAt: number;
  total: number;
  stats: {
    value: number;
    label: string;
    diff?: number;
  }[];
  logout: () => void;
  reload: () => void;
  setDatabases: (databases: DatabaseInfo[]) => void;
  token?: string;
}

export function AccountCard({
  type,
  database,
  title,
  updatedAt,
  total,
  stats,
  logout,
  reload,
  setDatabases,
  token,
}: AccountCardProps) {
  const items = stats.map((stat) => {
    let color = "gray.5";
    let DiffIcon: React.FC<TablerIconsProps> = IconArrowRight;
    if (stat.diff) {
      const sign = Math.sign(stat.diff);
      if (sign === 1) {
        DiffIcon = IconArrowUpRight;
        color = "green";
      } else {
        DiffIcon = IconArrowDownRight;
        color = "red";
      }
    }
    return (
      <Card key={stat.label} withBorder p="xs">
        <Group align="baseline" justify="space-between">
          <div>
            <Text fw="bold" fz="sm">
              {stat.value}
            </Text>
            <Text size="xs" c="dimmed">
              {capitalize(stat.label)}
            </Text>
          </div>
          {stat.diff && (
            <Text c={color} size="xs" fw={500} className={classes.diff}>
              <span>{stat.diff}</span>
              <DiffIcon size="1rem" stroke={1.5} />
            </Text>
          )}
        </Group>
      </Card>
    );
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function convert(filepath: string, timestamp: number | null) {
    info(`converting ${filepath} ${timestamp}`);
    const filename = title + (type === "lichess" ? " Lichess" : " Chess.com");
    const dbPath = await resolve(
      await appDataDir(),
      "db",
      `${filepath
        .split(/(\\|\/)/g)
        .pop()!
        .replace(".pgn", ".db3")}`,
    );
    unwrap(
      await commands.convertPgn(
        filepath,
        dbPath,
        timestamp ? timestamp / 1000 : null,
        filename,
        null,
      ),
    );
    events.downloadProgress.emit({
      id: `${type}_${title}`,
      progress: 100,
      finished: true,
    });
  }

  useEffect(() => {
    const unlisten = events.downloadProgress.listen(async (e) => {
      if (e.payload.id === `${type}_${title}`) {
        setProgress(e.payload.progress);
        if (e.payload.finished) {
          setLoading(false);
          setDatabases(await getDatabases());
        } else {
          setLoading(true);
        }
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [setDatabases]);

  const downloadedGames =
    database?.type === "success" ? database.game_count : 0;
  const percentage = ((downloadedGames / total) * 100).toFixed(2);

  async function getLastGameDate({
    database,
  }: {
    database: DatabaseInfo;
  }) {
    const games = await query_games(database.file, {
      options: {
        page: 1,
        pageSize: 1,
        sort: "date",
        direction: "desc",
        skipCount: false,
      },
    });
    if (games.count! > 0 && games.data[0].date && games.data[0].time) {
      const [year, month, day] = games.data[0].date.split(".").map(Number);
      const [hour, minute, second] = games.data[0].time.split(":").map(Number);
      const d = Date.UTC(year, month - 1, day, hour, minute, second);
      return d;
    }
    return null;
  }

  return (
    <Accordion.Item value={type + title}>
      <Group
        justify="space-between"
        wrap="nowrap"
        pos="relative"
        pl="sm"
        className={classes.accordion}
      >
        <Stack>
          <Group wrap="nowrap">
            {type === "lichess" ? (
              <LichessLogo />
            ) : (
              <img width={30} height={30} src="/chesscom.png" alt="chess.com" />
            )}
            <div>
              <Group wrap="nowrap">
                <Text size="md" fw="bold">
                  {title}
                </Text>
              </Group>
              <ActionIcon.Group>
                <Tooltip label="Update stats">
                  <ActionIcon onClick={() => reload()}>
                    <IconRefresh size="1rem" />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Download games">
                  <ActionIcon
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      const lastGameDate = database
                        ? await getLastGameDate({ database })
                        : null;
                      if (type === "lichess") {
                        await downloadLichess(
                          title,
                          lastGameDate,
                          total - downloadedGames,
                          setProgress,
                          token,
                        );
                      } else {
                        await downloadChessCom(title, lastGameDate);
                      }
                      const p = await resolve(
                        await appDataDir(),
                        "db",
                        `${title}_${type}.pgn`,
                      );
                      try {
                        await convert(p, lastGameDate);
                      } catch (e) {
                        console.error(e);
                      }
                      setLoading(false);
                    }}
                  >
                    {loading ? (
                      <Loader size="1rem" />
                    ) : (
                      <IconDownload size="1rem" />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Remove account">
                  <ActionIcon onClick={() => logout()}>
                    <IconX size="1rem" />
                  </ActionIcon>
                </Tooltip>
              </ActionIcon.Group>
            </div>
          </Group>
        </Stack>
        <Accordion.Control>
          <Stack gap="xs">
            <Group ta="center" justify="right">
              <div>
                <Text fw="bold">{total}</Text>
                <Text size="xs" c="dimmed">
                  Games
                </Text>
              </div>

              <div>
                <Tooltip label={`${downloadedGames} games`}>
                  <Text fw="bold">{percentage}%</Text>
                </Tooltip>
                <Text size="xs" c="dimmed">
                  Downloaded
                </Text>
              </div>
            </Group>
          </Stack>
        </Accordion.Control>

        {loading && (
          <Progress
            pos="absolute"
            bottom={0}
            left={0}
            w="100%"
            value={progress || 100}
            animated
            size="xs"
          />
        )}
      </Group>

      <Accordion.Panel p={0}>
        <Group grow>{items}</Group>
        <Text mt="xs" size="xs" c="dimmed" ta="right">
          ({`last update: ${new Date(updatedAt).toLocaleDateString()}`})
        </Text>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
