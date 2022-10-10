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
  setTree,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
}) {
  const topVariation = getTopVariation(tree);
  const currentVariation = tree;
  return (
    <Paper withBorder p="md">
      {/* <SimpleGrid cols={2}> */}
      <RenderVariationTree tree={topVariation} />
      {/* </SimpleGrid> */}
    </Paper>
  );

  function MoveCell({ move, tree }: { move: Move; tree: VariationTree }) {
    const isCurrentVariation = tree === currentVariation;
    return (
      <Button
        // disabled={isCurrentVariation}
        variant={isCurrentVariation ? "light" : "subtle"}
        onClick={() => {
          setTree(tree);
        }}
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
          {lastMove && <MoveCell move={lastMove} tree={tree} />}
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
