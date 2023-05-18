import { Paper, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { NormalizedGame, Tournament, getTournamentGames } from "../../utils/db";


function PlayerCard({ tournament, file }: { tournament: Tournament; file: string }) {
  const [games, setGames] = useState<NormalizedGame[]>([]);

  useEffect(() => {
    let ignored = false;
    async function fetchGames() {
      const games = (await getTournamentGames(file, tournament.id));
      if (ignored) return;
      setGames(games.data);
    }
    fetchGames();

    return () => {
      ignored = true;
    }
  }, [tournament.id]);

  return (
    <Paper shadow="sm" p="sm" withBorder>
      <Stack align="center">
        <Text fz="lg" weight={500}>
          {tournament.name}
        </Text>
      </Stack>

      <Text align="center">{games.length} Games</Text>

    </Paper>
  );
}

export default PlayerCard;
