import { events } from "@/bindings";
import { downloadChessCom } from "@/utils/chesscom";
import { DatabaseInfo, getDatabases, query_games } from "@/utils/db";
import { capitalize } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import { downloadLichess } from "@/utils/lichess";
import {
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
  TablerIconsProps,
} from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";
import { info } from "tauri-plugin-log-api";
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
            <Text fw="bold">{stat.value}</Text>
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
  const [lastGameDate, setLastGameDate] = useState<number | null>(null);

  async function convert(filepath: string, timestamp: number | null) {
    info(`converting ${filepath} ${timestamp}`);
    await invoke("convert_pgn", {
      file: filepath,
      timestamp,
      title: title + (type === "lichess" ? " Lichess" : " Chess.com"),
    });
    setLoading(false);
    setDatabases(await getDatabases());
  }

  const downloadedGames = database?.game_count ?? 0;
  const percentage = ((downloadedGames / total) * 100).toFixed(2);

  useEffect(() => {
    if (database) {
      query_games(database.file, {
        page: 1,
        pageSize: 1,
        sort: "date",
        direction: "desc",
      }).then((games) => {
        if (games.count > 0 && games.data[0].date && games.data[0].time) {
          const [year, month, day] = games.data[0].date.split(".").map(Number);
          const [hour, minute, second] = games.data[0].time
            .split(":")
            .map(Number);
          const d = Date.UTC(year, month - 1, day, hour, minute, second);
          setLastGameDate(d);
        }
      });
    }
  }, [database]);

  return (
    <Card withBorder p="lg" pos="relative" radius="md" className={classes.card}>
      <Group grow align="start">
        <Stack>
          <Group>
            {type === "lichess" ? (
              <LichessLogo />
            ) : (
              <img width={35} height={35} src="/chesscom.png" alt="chess.com" />
            )}
            <div>
              <Text size="xl" fw="bold">
                {title}
              </Text>
              <Text mt={5} size="sm" c="dimmed">
                {`Last Updated: ${new Date(updatedAt).toLocaleDateString()}`}
              </Text>
            </div>
          </Group>
        </Stack>
        <Stack gap="xs">
          <Group justify="right">
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
                  if (type === "lichess") {
                    await downloadLichess(
                      title,
                      lastGameDate,
                      total - downloadedGames,
                      setProgress,
                      token,
                    );
                  } else {
                    await downloadChessCom(title, lastGameDate, setProgress);
                  }
                  const p = await resolve(
                    await appDataDir(),
                    "db",
                    `${title}_${type}.pgn`,
                  );
                  convert(p, lastGameDate).catch(() => {
                    setLoading(false);
                  });
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
          </Group>

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
      </Group>
      <Group grow mt="lg">
        {items}
      </Group>
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
    </Card>
  );
}
