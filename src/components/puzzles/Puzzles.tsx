import {
  ActionIcon,
  Card,
  Divider,
  Group,
  RangeSlider,
  SimpleGrid,
  Stack,
  Text,
  Tooltip
} from "@mantine/core";
import { useLocalStorage, useSessionStorage } from "@mantine/hooks";
import { IconCheck, IconDots, IconPlus, IconTrash, IconX } from "@tabler/icons";
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
  const [puzzles, setPuzzles] = useSessionStorage<Puzzle[]>({
    key: id,
    defaultValue: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useState(0);

  const [ratingRange, setRatingRange] = useLocalStorage<[number, number]>({
    key: "puzzle-ratings",
    defaultValue: [1000, 1500],
  });

  const wonPuzzles = puzzles.filter(
    (puzzle) => puzzle.completion === Completion.CORRECT
  );
  const lostPuzzles = puzzles.filter(
    (puzzle) => puzzle.completion === Completion.INCORRECT
  );
  const averageWonRating =
    wonPuzzles.reduce((acc, puzzle) => acc + puzzle.rating, 0) /
    wonPuzzles.length;
  const averageLostRating =
    lostPuzzles.reduce((acc, puzzle) => acc + puzzle.rating, 0) /
    lostPuzzles.length;

  function generatePuzzle() {
    invoke("get_puzzle", {
      file: "C:\\Users\\Francisco\\Desktop\\puzzles.sql",
      minRating: ratingRange[0],
      maxRating: ratingRange[1],
    }).then((res: any) => {
      res.moves = res.moves.split(" ");
      res.completion = Completion.INCOMPLETE;
      setPuzzles((puzzles) => {
        return [...puzzles, res];
      });
      setCurrentPuzzle(puzzles.length);
    });
  }

  function changeCompletion(completion: Completion) {
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      return [...puzzles];
    });
  }

  useEffect(() => {
    if (sessionStorage.getItem(id) === null) {
      generatePuzzle();
    }
  }, []);

  return (
    <SimpleGrid cols={2} breakpoints={[{ maxWidth: 800, cols: 1 }]}>
      {puzzles[currentPuzzle] && (
        <PuzzleBoard
          key={currentPuzzle}
          puzzles={puzzles}
          currentPuzzle={currentPuzzle}
          changeCompletion={changeCompletion}
          generatePuzzle={generatePuzzle}
          setCurrentPuzzle={setCurrentPuzzle}
        />
      )}
      <Stack>
        <Card>
          <Group>
            <div>
              <Text size="sm" color="dimmed">
                Rating
              </Text>
              <Text weight={500} size="xl">
                {puzzles[currentPuzzle]?.rating}
              </Text>
            </div>
            {averageWonRating && (
              <div>
                <Text size="sm" color="dimmed">
                  Average Won Rating
                </Text>
                <Text weight={500} size="xl">
                  {averageWonRating.toFixed(0)}
                </Text>
              </div>
            )}
            {averageLostRating && (
              <div>
                <Text size="sm" color="dimmed">
                  Average Lost Rating
                </Text>
                <Text weight={500} size="xl">
                  {averageLostRating.toFixed(0)}
                </Text>
              </div>
            )}
          </Group>
          <Divider my="sm" />
          <Text>Rating Range</Text>
          <RangeSlider
            min={600}
            max={2800}
            value={ratingRange}
            onChange={setRatingRange}
          />
          <Divider my="sm" />
          <Group>
            <Tooltip label="New Puzzle">
              <ActionIcon onClick={() => generatePuzzle()}>
                <IconPlus />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Clear Session">
              <ActionIcon onClick={() => setPuzzles([])}>
                <IconTrash />
              </ActionIcon>
            </Tooltip>
          </Group>
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
