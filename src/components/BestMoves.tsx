import { Box, Button, Paper, Table, Text } from "@mantine/core";
import { VariationTree } from "../utils/chess";
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
  function MoveCell({ move, index }: { move: String; index: number }) {
    function addChessToTree(index: number) {
      let newTree = tree;
      const newChess = newTree.position.clone();
      for (let i = 0; i <= index; i++) {
        newChess.move(engineVariation.moves?.history()[i + tree.position.history().length] || "");
        newTree.addChild(newChess.clone());
        newTree = newTree.children[0];
      }
      setTree(newTree);
    }
    return (
      <Button
        variant="subtle"
        onClick={() => {
          addChessToTree(index);
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
                {engineVariation.moves?.history().slice(tree.position.history().length).map((move, index) => (
                  <MoveCell move={move} index={index} />
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
