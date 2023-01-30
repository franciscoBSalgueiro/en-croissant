import {
  ActionIcon,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text
} from "@mantine/core";
import { IconCheck, IconDots, IconX } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import PuzzleBoard from "./PuzzleBoard";

export enum Completion {
  CORRECT,
  INCORRECT,
  INCOMPLETE,
}

export interface Puzzle {
  fen: string;
  moves: string[];
  rating: number;
  rating_deviation: number;
  popularity: number;
  nb_plays: number;
  completion: Completion;
}

function Puzzles({ id }: { id: string }) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState(-1); // FIXME: not very pretty

  function generatePuzzle() {
    invoke("get_puzzle", {
      file: "C:\\Users\\Francisco\\Desktop\\puzzles.sql",
    }).then((res: any) => {
      res.moves = res.moves.split(" ");
      res.completion = Completion.INCOMPLETE;
      setPuzzles((puzzles) => {
        return [...puzzles, res];
      });
      setCurrentPuzzle((currentPuzzle) => currentPuzzle + 1);
    });
  }

  useEffect(() => {
    generatePuzzle();
  }, []);

  function changeCompletion(completion: Completion) {
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      return [...puzzles];
    });
  }

  return (
    <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
      {puzzles[currentPuzzle] && (
        <PuzzleBoard
          key={currentPuzzle}
          puzzles={puzzles}
          currentPuzzle={currentPuzzle}
          changeCompletion={changeCompletion}
          generatePuzzle={generatePuzzle}
        />
      )}
      <Stack>
        <Card>
          <Text size="sm" color="dimmed">
            Rating
          </Text>
          <Text weight={500} size="xl">
            {puzzles[currentPuzzle]?.rating}
          </Text>
        </Card>
        <Card>
          <Text>Results</Text>
          <Group>
            {puzzles.map((p, i) => {
              switch (p.completion) {
                case Completion.CORRECT:
                  return (
                    <ActionIcon
                      onClick={() => setCurrentPuzzle(i)}
                      variant="light"
                      key={i}
                      color="green"
                    >
                      <IconCheck color="green" />
                    </ActionIcon>
                  );
                case Completion.INCORRECT:
                  return (
                    <ActionIcon
                      onClick={() => setCurrentPuzzle(i)}
                      variant="light"
                      key={i}
                      color="red"
                    >
                      <IconX color="red" />
                    </ActionIcon>
                  );
                case Completion.INCOMPLETE:
                  return (
                    <ActionIcon
                      onClick={() => setCurrentPuzzle(i)}
                      variant="light"
                      key={i}
                      color="yellow"
                    >
                      <IconDots color="yellow" />
                    </ActionIcon>
                  );
              }
            })}
          </Group>
        </Card>
      </Stack>
    </SimpleGrid>
  );
}

export default Puzzles;
