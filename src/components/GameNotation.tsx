import { Box, Button, Menu, Paper } from "@mantine/core";
import { useClickOutside, useForceUpdate, useToggle } from "@mantine/hooks";
import { IconChevronUp, IconTrash } from "@tabler/icons";
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
      <Box sx={{ minHeight: "300px" }}>
        {/* <SimpleGrid cols={2}> */}
        <RenderVariationTree tree={topVariation} depth={0} />
        {/* </SimpleGrid> */}
      </Box>
    </Paper>
  );

  function MoveCell({
    move,
    variation,
  }: {
    move: string;
    variation: VariationTree;
  }) {
    const isCurrentVariation = variation.equals(tree);
    const [open, toggleOpen] = useToggle();
    const ref = useClickOutside(() => toggleOpen(false));

    return (
      <Menu opened={open} width={200}>
        <Menu.Target ref={ref}>
          <Button
            sx={{width: "80px"}}
            variant={isCurrentVariation ? "light" : "subtle"}
            onContextMenu={() => {
              toggleOpen();
            }}
            onClick={() => {
              setTree(variation);
              toggleOpen(false);
            }}
          >
            {move}
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

  function RenderVariationTree({
    tree,
    depth,
  }: {
    tree: VariationTree;
    depth: number;
  }) {
    const moves = tree.pgn.split(" ");
    const lastMove = moves[moves.length - 1];
    return (
      <>
        <span>
          {lastMove && <MoveCell move={lastMove} variation={tree} />}
          {tree.children.length > 0 && (
            <RenderVariationTree tree={tree.children[0]} depth={depth + 1} />
          )}
        </span>
        {tree.children.slice(1).map((child) => (
          <>
            <div>
              <span style={{ marginLeft: (depth * 80) + "px" }} />

              <RenderVariationTree tree={child} depth={depth + 1} />
            </div>
          </>
        ))}
      </>
    );
  }
}

export default GameNotation;
