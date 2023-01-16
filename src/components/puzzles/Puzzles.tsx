import { Card, Container, Group, Stack, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import PuzzleBoard from "./PuzzleBoard";

export interface Puzzle {
  fen: string;
  moves: string;
  rating: number;
  rating_deviation: number;
  popularity: number;
  nb_plays: number;
}

function Puzzles({ id }: { id: string }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>();

  useEffect(() => {
    invoke("get_puzzle", {
      file: "C:\\Users\\Francisco\\Desktop\\puzzles.sql",
    }).then((res) => {
      setPuzzle(res as Puzzle);
    });
  }, []);

  return (
    <Container size="sm" px={0}>
      <Stack>
        {puzzle && <PuzzleBoard puzzle={puzzle} />}
        <Card>
          <Group position="center">
            <Stack align="center" spacing={0}>
              <Text size="sm" color="dimmed">
                Rating
              </Text>
              <Text weight={500} size="lg">
                {puzzle?.rating}
              </Text>
            </Stack>
            <Stack align="center" spacing={0}>
              <Text size="sm" color="dimmed">
                Popularity
              </Text>
              <Text weight={500} size="lg">
                {puzzle?.popularity}%
              </Text>
            </Stack>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}

export default Puzzles;
