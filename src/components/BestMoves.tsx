import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  ChevronIcon,
  createStyles,
  Flex,
  Group,
  Progress,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip
} from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import Image from "next/image";
import { useEffect, useState } from "react";
import { EngineVariation, Score } from "../utils/chess";
import { Engine } from "../utils/engines";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color: theme.fn.rgba(theme.white, 0.65),
  },
}));

function ScoreBubble({ score }: { score: Score }) {
  const scoreNumber = score.cp || score.mate;
  let scoreText = "";
  const type = score.cp ? "cp" : "mate";
  if (type === "cp") {
    scoreText = Math.abs(scoreNumber / 100).toFixed(2);
  } else {
    scoreText = "M" + Math.abs(scoreNumber);
  }
  scoreText = (scoreNumber > 0 ? "+" : "-") + scoreText;
  return (
    <Box
      sx={(theme) => ({
        backgroundColor:
          scoreNumber >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: 5,
        borderRadius: theme.radius.md,
        width: 70,
      })}
    >
      <Text
        weight={700}
        color={scoreNumber >= 0 ? "black" : "white"}
        size="md"
        align="center"
        sx={(theme) => ({
          fontFamily: theme.fontFamilyMonospace,
        })}
      >
        {scoreText}
      </Text>
    </Box>
  );
}

interface BestMovesProps {
  engine: Engine;
  numberLines: number;
  makeMoves: (moves: string[]) => void;
  half_moves: number;
  max_depth: number;
}

function BestMoves({
  numberLines,
  makeMoves,
  engine,
  half_moves,
  max_depth,
}: BestMovesProps) {
  const [engineVariations, setEngineVariation] = useState<EngineVariation[]>(
    []
  );
  const { classes } = useStyles();
  const depth = engineVariations[0]?.depth ?? 0;
  const nps = Math.floor(engineVariations[0]?.nps / 1000 ?? 0);
  const progress = (depth / max_depth) * 100;

  useEffect(() => {
    async function waitForMove() {
      await listen("best_moves", (event) => {
        const ev = event.payload as EngineVariation[];
        if (ev[0].engine === engine.path) {
          setEngineVariation(ev);
        }
      });
    }

    waitForMove();
  }, []);

  function AnalysisRow({
    score,
    moves,
    uciMoves,
    index,
  }: {
    score: Score;
    moves: string[];
    uciMoves: string[];
    index: number;
  }) {
    const currentOpen = open[index];

    return (
      <tr style={{ verticalAlign: "top" }}>
        <td>
          <ScoreBubble score={score} />
        </td>
        <td>
          <Flex
            direction="row"
            wrap="wrap"
            sx={{
              height: currentOpen ? "100%" : 35,
              overflow: "hidden",
            }}
          >
            {moves.map((move, index) => {
              const total_moves = half_moves + index + 1;
              const is_black = total_moves % 2 === 1;
              const move_number = Math.ceil(total_moves / 2);

              return (
                <MoveCell
                  moveNumber={move_number}
                  isBlack={is_black}
                  moves={uciMoves}
                  move={move}
                  index={index}
                  key={total_moves + move}
                />
              );
            })}
          </Flex>
        </td>
        <td>
          <ActionIcon
            style={{
              transition: "transform 200ms ease",
              transform: currentOpen ? `rotate(180deg)` : "none",
            }}
            onClick={() =>
              setOpen((prev) => {
                return {
                  ...prev,
                  [index]: !prev[index],
                };
              })
            }
          >
            <ChevronIcon />
          </ActionIcon>
        </td>
      </tr>
    );
  }

  function MoveCell({
    moves,
    move,
    index,
    isBlack,
    moveNumber,
  }: {
    moves: string[];
    move: string;
    index: number;
    isBlack: boolean;
    moveNumber: number;
  }) {
    const first = index === 0;
    return (
      <Button
        variant="subtle"
        onClick={() => {
          makeMoves(moves.slice(0, index + 1));
        }}
      >
        {(isBlack || first) && <span>{moveNumber.toFixed(0) + "."}</span>}
        {first && !isBlack && ".."}
        {move}
      </Button>
    );
  }

  const [open, setOpen] = useState<boolean[]>([]);

  return (
    <Accordion.Item value={engine.name}>
      <Accordion.Control>
        <Group position="apart">
          <Group align="baseline">
            <Image
              src={engine.image}
              height={20}
              width={20}
              alt={engine.name}
            />
            <Text fw="bold" fz="xl">
              {engine.name}
            </Text>
            {progress < 100 && (
              <Tooltip label={"How fast the engine is running"}>
                <Text>{nps}k nodes/s</Text>
              </Tooltip>
            )}
          </Group>
          <Stack align="center" spacing={0}>
            <Text
              size="xs"
              transform="uppercase"
              weight={700}
              className={classes.subtitle}
            >
              Depth
            </Text>
            <Text fw="bold" fz="xl">
              {depth}
            </Text>
          </Stack>
        </Group>
      </Accordion.Control>
      <Progress value={progress} animate={progress < 100} size="xs" />
      <Accordion.Panel>
        <Table>
          <tbody>
            {engineVariations.length === 0 &&
              Array.apply(null, Array(numberLines)).map((_, i) => (
                <tr key={i}>
                  <td>
                    <Skeleton height={50} radius="xl" p={5} />
                  </td>
                </tr>
              ))}
            {engineVariations.map((engineVariation, index) => {
              return (
                <AnalysisRow
                  key={engineVariation.sanMoves.join("")}
                  score={engineVariation.score}
                  moves={engineVariation.sanMoves}
                  uciMoves={engineVariation.uciMoves}
                  index={index}
                />
              );
            })}
          </tbody>
        </Table>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export default BestMoves;
