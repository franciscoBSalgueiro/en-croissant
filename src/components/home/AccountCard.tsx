import {
  ActionIcon,
  Card,
  Group,
  Loader,
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
import { downloadChessCom } from "../../utils/chesscom";
import { DatabaseInfo, getDatabases, query_games } from "../../utils/db";
import { downloadLichess } from "../../utils/lichess";
import { invoke } from "../../utils/misc";
import ChessComLogo from "./ChessComLogo";
import LichessLogo from "./LichessLogo";
import useStyles from "./styles";

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
  const { classes } = useStyles();
  const items = stats.map((stat) => {
    let color = "gray.5";
    let DiffIcon: React.FC<TablerIconsProps> = IconArrowRight;
    if (stat.diff) {
      switch (Math.sign(stat.diff)) {
        case 1:
          DiffIcon = IconArrowUpRight;
          color = "green";
          break;
        case -1:
          DiffIcon = IconArrowDownRight;
          color = "red";
          break;
      }
    }
    return (
      <div key={stat.label} className={classes.rating}>
        <Group align="baseline" position="apart">
          <div>
            <Text className={classes.label}>{stat.value}</Text>
            <Text size="xs" color="dimmed">
              {stat.label}
            </Text>
          </div>
          {stat.diff && (
            <Text color={color} size="sm" weight={500} className={classes.diff}>
              <span>{stat.diff}</span>
              <DiffIcon size={16} stroke={1.5} />
            </Text>
          )}
        </Group>
      </div>
    );
  });
  const [loading, setLoading] = useState(false);
  const [lastGameDate, setLastGameDate] = useState<Date | null>(null);
  const timestamp = lastGameDate?.getTime() ?? null;

  async function convert(filepath: string, timestamp: number | null) {
    console.log("converting", filepath);
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
        if (games.count > 0) {
          setLastGameDate(
            new Date(games.data[0].date + " " + games.data[0].time)
          );
        }
      });
    }
  }, [database]);

  return (
    <Card withBorder p="xl" radius="md" className={classes.card}>
      <Group grow>
        <div>
          <Group>
            {type === "lichess" ? <LichessLogo /> : <ChessComLogo />}
            <div>
              <Text size="xl" className={classes.label}>
                {title}
              </Text>
              <Text mt={5} size="sm" color="dimmed">
                {"Last Updated: " + new Date(updatedAt).toLocaleDateString()}
              </Text>
            </div>
          </Group>
          <Group>
            <div>
              <Text className={classes.lead} mt={30}>
                {total}
              </Text>
              <Text size="xs" color="dimmed">
                Total Games
              </Text>
            </div>

            <div>
              <Tooltip label={`${downloadedGames} games`}>
                <Text className={classes.lead} mt={30}>
                  {percentage}%
                </Text>
              </Tooltip>
              <Text size="xs" color="dimmed">
                Downloaded Games
              </Text>
            </div>
          </Group>
        </div>
        <Stack align="end" justify="flex-start">
          <Tooltip label="Update stats">
            <ActionIcon onClick={() => reload()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download games">
            <ActionIcon
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                if (type === "lichess") {
                  await downloadLichess(title, timestamp, token);
                } else {
                  await downloadChessCom(title, timestamp);
                }
                const p = await resolve(
                  await appDataDir(),
                  "db",
                  `${title}_${type}.pgn`
                );
                convert(p, timestamp).catch((err) => {
                  setLoading(false);
                  console.error(err);
                });
              }}
            >
              {loading ? <Loader size={16} /> : <IconDownload size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove account">
            <ActionIcon onClick={() => logout()}>
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Stack>
      </Group>
      <Group grow mt="lg">
        {items}
      </Group>
    </Card>
  );
}
