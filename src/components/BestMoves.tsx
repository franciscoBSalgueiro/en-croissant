import { Box, Button, Paper, Table, Text } from "@mantine/core";
import { Chess } from "chess.ts";
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
  const chess = new Chess();
  chess.loadPgn(tree.position);
  function MoveCell({ move, index }: { move: String; index: number }) {
    function addChessToTree(index: number) {
      let newTree = tree;
      const newChess = new Chess();
      newChess.loadPgn(newTree.position);
      for (let i = 0; i <= index; i++) {
        newChess.move(engineVariation.moves?.history()[i + newChess.history().length] || "");
        newTree.addChild(newChess.pgn());
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
                {engineVariation.moves?.history().slice(chess.history().length).map((move, index) => (
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
