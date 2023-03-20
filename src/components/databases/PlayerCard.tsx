import { createStyles, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { getPlayersGameInfo, Player } from "../../utils/db";

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
  games_per_month: [string, number][];
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
      const games = (await getPlayersGameInfo(file, player)) as PlayerGameInfo;
      setInfo(games);
    }
    fetchGames();
  }, [player.id]);

  return (
    <Paper shadow="sm" p="sm" withBorder>
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

      <Group>
        {info?.games_per_month.map(([month, games]) => (
          <Text key={month} align="center">
            {month}: {games}
          </Text>
        ))}
      </Group>
    </Paper>
  );
}

export default PlayerCard;
