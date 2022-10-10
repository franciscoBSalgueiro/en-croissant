import { Button, Paper } from "@mantine/core";
import { Chess, Move } from "chess.ts";
import { getLastMove } from "../utils/chess";

export interface VariationTree {
  parent: VariationTree | null;
  position: Chess;
  children: VariationTree[];
}

function getTopVariation(tree: VariationTree): VariationTree {
  if (tree.parent) {
    return getTopVariation(tree.parent);
  }
  return tree;
}

function GameNotation({
  tree,
  setChess,
}: {
  tree: VariationTree;
  setChess: (move: Chess) => void;
}) {
  const topVariation = getTopVariation(tree);
  return (
    <Paper withBorder p="md">
      {/* <SimpleGrid cols={2}> */}
      <RenderVariationTree tree={topVariation} />
      {/* </SimpleGrid> */}
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
    const lastMove = getLastMove(tree.position);
    return (
      <>
        <span>
          {lastMove && <MoveCell move={lastMove} />}
          {tree.children.length > 0 && (
            <RenderVariationTree tree={tree.children[0]} />
          )}
        </span>
        {tree.children.slice(1).map((child) => (
          <>
            <p>Test</p>
            <RenderVariationTree tree={child} />
          </>
        ))}
      </>
    );
  }
}

export default GameNotation;
