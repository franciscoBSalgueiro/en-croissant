import { Box, Button, Paper, Table, Text } from "@mantine/core";
import { Chess } from "chess.ts";
import { getLastChessMove, VariationTree } from "../utils/chess";
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

interface BestMovesProps {
  engineVariation: EngineVariation;
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
}

function BestMoves({ engineVariation, tree, setTree }: BestMovesProps) {
  function addChessesToVariationTree(chesses: Chess[]): void {
    let currentTree = tree;
    for (const chess of chesses) {
      currentTree.children.push(new VariationTree(currentTree, chess));
      currentTree = currentTree.children[currentTree.children.length - 1];
    }
    setTree(currentTree);
  }
  function MoveCell({ index }: { index: number }) {
    // if (getLastChessMove(chess) == null) {
    // console.log(chess.history());
    // }
    return (
      <Button
        variant="subtle"
        onClick={() => {
          addChessesToVariationTree(
            engineVariation.moves.slice(0, index + 1)
          );
        }}
      >
        {getLastChessMove(engineVariation.moves[index])?.san ?? "No move"}
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
                {engineVariation.moves.map((move, index) => (
                  <MoveCell index={index} />
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
