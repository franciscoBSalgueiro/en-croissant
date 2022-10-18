import { Button, Menu, Paper } from "@mantine/core";
import { useClickOutside, useForceUpdate, useToggle } from "@mantine/hooks";
import { IconChevronUp, IconTrash } from "@tabler/icons";
import { Move } from "chess.ts";
import { VariationTree } from "../utils/chess";

function GameNotation({
  tree,
  setTree,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
}) {
  const forceUpdate = useForceUpdate();
  const topVariation = tree.getTopVariation();

  function promoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        variation,
        ...parent.children.filter((child) => child !== variation),
      ];
      if (isCurrent) {
        forceUpdate();
      } else {
        setTree(variation);
      }
    }
  }

  function deleteVariation(variation: VariationTree) {
    const isInCurrentBranch = tree.isInBranch(variation);
    const parent = variation.parent;
    if (parent) {
      parent.children = parent.children.filter((child) => child !== variation);
      if (isInCurrentBranch) {
        setTree(parent);
      } else {
        forceUpdate();
      }
    }
  }

  return (
    <Paper withBorder p="md">
      {/* <SimpleGrid cols={2}> */}
      <RenderVariationTree tree={topVariation} />
      {/* </SimpleGrid> */}
    </Paper>
  );

  function MoveCell({
    move,
    variation,
  }: {
    move: Move;
    variation: VariationTree;
  }) {
    const isCurrentVariation = variation.equals(tree);
    const [open, toggleOpen] = useToggle();
    const ref = useClickOutside(() => toggleOpen(false));

    return (
      <Menu opened={open} width={200}>
        <Menu.Target ref={ref}>
          <Button
            variant={isCurrentVariation ? "light" : "subtle"}
            onContextMenu={() => {
              toggleOpen();
            }}
            onClick={() => {
              setTree(variation);
              toggleOpen(false);
            }}
          >
            {move.san}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Actions</Menu.Label>
          <Menu.Item
            icon={<IconChevronUp size={14} />}
            onClick={() => promoteVariation(variation)}
          >
            Promote Variation
          </Menu.Item>
          <Menu.Item
            color="red"
            icon={<IconTrash size={14} />}
            onClick={() => deleteVariation(variation)}
          >
            Delete Move
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }

  function RenderVariationTree({ tree }: { tree: VariationTree }) {
    const lastMove = tree.getLastMove();
    return (
      <>
        <span>
          {lastMove && <MoveCell move={lastMove} variation={tree} />}
          {tree.children.length > 0 && (
            <RenderVariationTree tree={tree.children[0]} />
          )}
        </span>
        {tree.children.slice(1).map((child) => (
          <>
            <div>
              <RenderVariationTree tree={child} />
            </div>
          </>
        ))}
      </>
    );
  }
}

export default GameNotation;
