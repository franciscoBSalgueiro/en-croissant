import {
  ActionIcon,
  Box,
  Button,
  ChevronIcon,
  Container,
  createStyles,
  Flex,
  Group,
  Paper,
  Skeleton,
  Table,
  Text,
  Title
} from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { Chess } from "chess.js";
import { useEffect, useState } from "react";
import { EngineVariation } from "../utils/chess";
import { Engine } from "../utils/engines";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color: theme.fn.rgba(theme.white, 0.65),
  },
}));

function ScoreBubble({ score, type }: { score: number; type: "cp" | "mate" }) {
  let scoreText = "";
  if (type === "cp") {
    scoreText = Math.abs(score / 100).toFixed(2);
  } else {
    scoreText = "M" + Math.abs(score);
  }
  scoreText = (score > 0 ? "+" : "-") + scoreText;
  return (
    <Box
      sx={(theme) => ({
        backgroundColor:
          score >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: theme.spacing.xs,
        borderRadius: theme.radius.md,
        width: 80,
      })}
    >
      <Text
        weight={700}
        color={score >= 0 ? "black" : "white"}
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
  chess: Chess;
  makeMoves: (moves: string[]) => void;
  half_moves: number;
}

function BestMoves({
  numberLines,
  chess,
  makeMoves,
  engine,
  half_moves
}: BestMovesProps) {
  const [engineVariations, setEngineVariation] = useState<EngineVariation[]>([]);
  const { classes } = useStyles();

  function AnalysisRow({
    score,
    type,
    moves,
  }: {
    score: number;
    type: "cp" | "mate";
    moves: string[];
  }) {
    const [open, setOpen] = useState(false);
    return (
      <tr style={{ verticalAlign: "top" }}>
        <td>
          <ScoreBubble score={score} type={type} />
        </td>
        <td>
          <Flex
            direction="row"
            wrap="wrap"
            sx={{
              height: open ? "100%" : 35,
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
                  moves={moves}
                  move={move}
                  index={index}
                  key={index}
                />
              );
            })}
          </Flex>
        </td>
        <td>
          <ActionIcon
            style={{
              transition: "transform 200ms ease",
              transform: open ? `rotate(180deg)` : "none",
            }}
            onClick={() => setOpen((v) => !v)}
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

  useEffect(() => {
    async function waitForMove() {
      await listen("best_moves", (event) => {
        setEngineVariation(event.payload as EngineVariation[]);
      });
    }

    waitForMove();
  }, []);

  return (
    <>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Group position="apart" mt="md" mb="xs">
          <Title>{engine.name}</Title>
          <Container m={0}>
            <Text
              size="xs"
              transform="uppercase"
              weight={700}
              className={classes.subtitle}
            >
              Depth
            </Text>
            <Title>{engineVariations[0]?.depth ?? 0}</Title>
          </Container>
        </Group>
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
            {engineVariations.map((engineVariation, i) => {
              let score = 0;
              let type: "mate" | "cp" = "cp";
              if (engineVariation.score.cp) {
                score = engineVariation.score.cp;
                type = "cp";
              }
              if (engineVariation.score.mate) {
                score = engineVariation.score.mate;
                type = "mate";
              }
              if (chess.turn() === "b") {
                score = -score;
              }
              return (
                <AnalysisRow
                  key={i}
                  score={score}
                  type={type}
                  moves={engineVariation.pv}
                />
              );
            })}
          </tbody>
        </Table>
      </Paper>
    </>
  );
}

export default BestMoves;
