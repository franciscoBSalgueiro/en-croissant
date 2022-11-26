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
import { Chess, Color } from "chess.ts";
import { useState } from "react";
import { EngineVariation, getLastChessMove } from "../utils/chess";
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
  engineVariations: EngineVariation[];
  numberLines: number;
  chess: Chess;
  makeMoves: (moves: string[]) => void;
}

function BestMoves({
  engineVariations,
  numberLines,
  chess,
  makeMoves,
  engine,
}: BestMovesProps) {
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
    const newChess = new Chess(chess.fen());
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
              newChess.move(move, {
                sloppy: true,
              });
              return (
                <MoveCell
                  moveNumber={
                    (chess.history().length + newChess.history().length) / 2
                  }
                  turn={newChess.turn()}
                  moves={moves}
                  move={getLastChessMove(newChess)?.san!}
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
              transition: 'transform 200ms ease',
              transform: open
                ? `rotate(180deg)`
                : "none",
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
    turn,
    moveNumber,
  }: {
    moves: string[];
    move: string;
    index: number;
    turn: Color;
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
        {(turn === "b" || first) && <span>{moveNumber.toFixed(0) + "."}</span>}
        {first && turn === "w" && ".."}
        {move}
      </Button>
    );
  }
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
              Array.apply(null, Array(numberLines)).map((_) => (
                <tr>
                  <td>
                    <Skeleton height={50} radius="xl" p={5} />
                  </td>
                </tr>
              ))}
            {engineVariations.map((engineVariation) => {
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
              let moves = engineVariation.pv.split(" ");
              if (chess.turn() === "b") {
                score = -score;
              }
              return <AnalysisRow score={score} type={type} moves={moves} />;
            })}
          </tbody>
        </Table>
      </Paper>
    </>
  );
}

export default BestMoves;
