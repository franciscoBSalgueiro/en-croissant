import { Box, Button, Paper, Table, Text } from "@mantine/core";
import { Chess } from "chess.ts";
import { EngineVariation } from "./BoardAnalysis";

function ScoreBubble({ score }: { score: number }) {
  return (
    <Box
      sx={(theme) => ({
        backgroundColor:
          score >= 0 ? theme.colors.gray[0] : theme.colors.dark[9],
        textAlign: "center",
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
      })}
    >
      <Text color={score >= 0 ? "black" : "white"}>{score}</Text>
    </Box>
  );
}

function MoveCell({ move }: { move: Chess }) {
  return (
    <Button
      variant="subtle"
      onClick={() => {
      }}
    >
      {move.history()[move.history().length - 1]}
    </Button>
  );
}

function BestMoves({ engineVariation }: { engineVariation: EngineVariation }) {
  return (
    <>
      <Paper p="md" radius="sm" withBorder>
        <h1>Stockfish</h1>
        <p>Depth: {engineVariation.depth}</p>
        <Table withBorder>
          <tbody>
            <tr>
              <td>
                {engineVariation.moves.map((move) => (
                  <MoveCell move={move} />
                ))}
              </td>
              <td>
                <ScoreBubble score={engineVariation.score / 100} />
              </td>
            </tr>
            <tr>
              <td>Move 2</td>
              <td>
                <ScoreBubble score={-1.6} />
              </td>
            </tr>
          </tbody>
        </Table>
      </Paper>

      <Paper p="md" radius="sm" withBorder>
        <h1>Stockfish</h1>
        <Table withBorder>
          <tbody>
            <tr>
              <td>Move 1</td>
              <td>Score 1</td>
            </tr>
            <tr>
              <td>Move 2</td>
              <td>Score 2</td>
            </tr>
          </tbody>
        </Table>
      </Paper>
    </>
  );
}

export default BestMoves;
