import { createStyles, Paper, Progress, Stack, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import { Player } from "../../utils/db";

const data = [
  {
    label: "Mobile",
    count: "204,001",
    part: 59,
    color: "#47d6ab",
  },
  {
    label: "Desktop",
    count: "121,017",
    part: 35,
    color: "#03141a",
  },
  {
    label: "Tablet",
    count: "31,118",
    part: 6,
    color: "#4fcdf7",
  },
];

const segments = data.map((segment) => ({
  value: segment.part,
  color: segment.color,
  label: segment.part > 10 ? `${segment.part}%` : undefined,
}));

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
}

function PlayerCard({ player, file }: { player: Player; file: string }) {
  const [info, setInfo] = useState<PlayerGameInfo | null>(null);
  const total = info ? info.won + info.lost + info.draw : 0;
  const { classes } = useStyles();

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
      const games = (await invoke("get_players_game_info", {
        file,
        id: player.id,
      })) as PlayerGameInfo;
      setInfo(games);
    }
    fetchGames();
  }, [player.id]);

  return (
    <Paper shadow="sm" p="sm" my="md" withBorder>
      <Stack align="center">
        <Text fz="lg" weight={500}>
          {player.name}
        </Text>
      </Stack>

      <Text align="center">{total} Games</Text>

      <Progress
        sections={sections}
        size={34}
        classNames={{ label: classes.progressLabel }}
        mt={40}
      />
    </Paper>
  );
}

export default PlayerCard;
