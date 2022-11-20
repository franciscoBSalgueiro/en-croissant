import {
  Box,
  Button,
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
import { Chess } from "chess.ts";
import { EngineVariation, getLastChessMove } from "../utils/chess";

const useStyles = createStyles((theme) => ({
  subtitle: {
    color: theme.fn.rgba(theme.white, 0.65),
  },
}));

function ScoreBubble({ score }: { score: number }) {
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
        {(score < 0 ? "" : "+") + score.toFixed(2)}
      </Text>
    </Box>
  );
}

interface BestMovesProps {
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
}: BestMovesProps) {
  const { classes } = useStyles();

  function MoveCell({
    moves,
    move,
    index,
  }: {
    moves: string[];
    move: string;
    index: number;
  }) {
    return (
      <Button
        variant="subtle"
        onClick={() => {
          makeMoves(moves.slice(0, index + 1));
        }}
      >
        {move}
      </Button>
    );
  }
  return (
    <>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Group position="apart" mt="md" mb="xs">
          <Title>Stockfish 13</Title>
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
              const newChess = new Chess(chess.fen());
              let score = engineVariation.score;
              let moves = engineVariation.pv.split(" ").slice(0, 10);
              if (chess.turn() === "b") {
                score = -score;
              }
              return (
                <tr>
                  <td>
                    <ScoreBubble score={score / 100} />
                  </td>
                  <td>
                    <Flex gap="xs" direction="row" wrap="nowrap">
                      {moves.map((move, index) => {
                        newChess.move(move, {
                          sloppy: true,
                        });
                        return (
                          <MoveCell
                            moves={moves}
                            move={getLastChessMove(newChess)?.san!}
                            index={index}
                            key={index}
                          />
                        );
                      })}
                    </Flex>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Paper>
    </>
  );
}

export default BestMoves;
