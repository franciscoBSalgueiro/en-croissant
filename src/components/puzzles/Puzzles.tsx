import {
  ActionIcon,
  Button,
  Card,
  Divider,
  Group,
  RangeSlider,
  SimpleGrid,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useLocalStorage, useSessionStorage } from "@mantine/hooks";
import {
  IconCheck,
  IconDots,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import BoardLayout from "../../layouts/BoardLayout";
import { invoke } from "../../utils/misc";
import {
  Completion,
  Puzzle,
  PuzzleDatabase,
  getPuzzleDatabases,
} from "../../utils/puzzles";
import PuzzleBoard from "./PuzzleBoard";
import { PuzzleDbCard } from "./PuzzleDbCard";

function Puzzles({ id }: { id: string }) {
  const [puzzles, setPuzzles] = useSessionStorage<Puzzle[]>({
    key: id,
    defaultValue: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useState(0);
  const [currentMove, setCurrentMove] = useState(1);

  const [puzzleDbs, setPuzzleDbs] = useState<PuzzleDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useLocalStorage<string | null>({
    key: "puzzle-db",
    defaultValue: null,
  });
  useEffect(() => {
    getPuzzleDatabases().then((databases) => {
      setPuzzleDbs(databases);
    });
  }, []);

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

  function generatePuzzle(db: string) {
    invoke<any>("get_puzzle", {
      file: db,
      minRating: ratingRange[0],
      maxRating: ratingRange[1],
    }).then((res) => {
      res.moves = res.moves.split(" ");
      res.completion = Completion.INCOMPLETE;
      setPuzzles((puzzles) => {
        return [...puzzles, res];
      });
      setCurrentPuzzle(puzzles.length);
      setCurrentMove(1);
    });
  }

  function changeCompletion(completion: Completion) {
    setPuzzles((puzzles) => {
      puzzles[currentPuzzle].completion = completion;
      return [...puzzles];
    });
  }

  const [tmpSelected, setTmpSelected] = useState<string | null>(null);

  return selectedDb === null || puzzles.length === 0 ? (
    <>
      <Title mb="md">Puzzle Collections</Title>
      <SimpleGrid cols={4} mb="md">
        {puzzleDbs.map((db) => (
          <PuzzleDbCard
            key={db.path}
            db={db}
            isSelected={tmpSelected === db.path}
            setSelected={setTmpSelected}
          />
        ))}
      </SimpleGrid>
      <Button
        onClick={() => {
          setSelectedDb(tmpSelected);
          generatePuzzle(tmpSelected!);
          setTmpSelected(null);
        }}
        disabled={tmpSelected === null}
        leftIcon={<IconCheck />}
      >
        Select
      </Button>
    </>
  ) : (
    <BoardLayout
      board={
        <PuzzleBoard
          key={currentPuzzle}
          puzzles={puzzles}
          currentPuzzle={currentPuzzle}
          changeCompletion={changeCompletion}
          generatePuzzle={generatePuzzle}
          setCurrentPuzzle={setCurrentPuzzle}
          currentMove={currentMove}
          setCurrentMove={setCurrentMove}
          db={selectedDb}
        />
      }
    >
      <div>
        <Card>
          <Group>
            <div>
              <Text size="sm" color="dimmed">
                Puzzle Rating
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
              <ActionIcon onClick={() => generatePuzzle(selectedDb)}>
                <IconPlus />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Clear Session">
              <ActionIcon
                onClick={() => {
                  setPuzzles([]);
                  setSelectedDb(null);
                }}
              >
                <IconTrash />
              </ActionIcon>
            </Tooltip>
            <Button
              onClick={async () => {
                const curPuzzle = puzzles[currentPuzzle];
                if (curPuzzle.completion === Completion.INCOMPLETE) {
                  changeCompletion(Completion.INCORRECT);
                }
                for (let i = currentMove; i < curPuzzle.moves.length; i++) {
                  setCurrentMove((currentMove) => currentMove + 1);
                  await new Promise((r) => setTimeout(r, 500));
                }
              }}
              disabled={currentMove === puzzles[currentPuzzle].moves.length}
            >
              View Solution
            </Button>
          </Group>
        </Card>
        <Card>
          <Text mb="md">Puzzles</Text>
          <Group>
            {puzzles.map((p, i) => {
              const current = i === currentPuzzle;
              switch (p.completion) {
                case Completion.CORRECT:
                  return (
                    <ActionIcon
                      onClick={() => {
                        setCurrentPuzzle(i);
                        setCurrentMove(1);
                      }}
                      variant="light"
                      key={i}
                      color="green"
                      sx={{ border: current ? "2px solid green" : "none" }}
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
                      sx={{ border: current ? "2px solid red" : "none" }}
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
                      sx={{ border: current ? "2px solid yellow" : "none" }}
                    >
                      <IconDots color="yellow" />
                    </ActionIcon>
                  );
              }
            })}
          </Group>
        </Card>
      </div>
    </BoardLayout>
  );
}

export default Puzzles;
