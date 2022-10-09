import { Button, Paper, SimpleGrid } from "@mantine/core";
import { Chess, Move } from "chess.ts";

export interface VariationTree {
  move: Move;
  children: VariationTree[];
}

function GameNotation({
  tree,
  setChess,
}: {
  tree: VariationTree;
  setChess: (move: Chess) => void;
}) {
  return (
    <Paper withBorder p="md">
      <SimpleGrid cols={2}>
        <RenderVariationTree tree={tree} />
      </SimpleGrid>
    </Paper>
  );

  function MoveCell({ move }: { move: Move }) {
    return (
      <Button
        variant="subtle"
        // onClick={() => {
        //   setChess(move);
        // }}
      >
        {move.san}
      </Button>
    );
  }

  function RenderVariationTree({ tree }: { tree: VariationTree }) {
    return (
      <>
        <MoveCell move={tree.move} />
        {tree.children.map((child) => (
          <RenderVariationTree tree={child} />
        ))}
      </>
    );
  }
}

export default GameNotation;
