import { Box, Button, Paper, Table, Text } from "@mantine/core";
import { Chess } from "chess.ts";
import { EngineVariation, getLastChessMove } from "../utils/chess";

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

interface BestMovesProps {
  engineVariation: EngineVariation;
  chess: Chess;
  makeMoves: (moves: string[]) => void;
}

function BestMoves({ engineVariation, chess, makeMoves }: BestMovesProps) {
  const newChess = new Chess(chess.fen());
  function MoveCell({ move, index }: { move: string, index: number }) {
    return (
      <Button
        variant="subtle"
        onClick={() => {
          makeMoves(engineVariation.moves.slice(0, index + 1));
        }}
      >
        {move}
      </Button>
    );
  }
  return (
    <>
      <Paper p="md" radius="sm" withBorder>
        <h1>Stockfish</h1>
        <p>Depth: {engineVariation.depth}</p>
        <Table withBorder>
          <tbody>
            <tr>
              <td>
                {engineVariation.moves.map((move, index) => {
                  newChess.move(move, { sloppy: true });
                  return <MoveCell move={getLastChessMove(newChess)?.san!} index={index} key={index} />;
                })}
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
