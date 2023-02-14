import { Box, createStyles } from "@mantine/core";
import { useContext } from "react";
import {
  Annotation, annotationColor, VariationTree
} from "../../utils/chess";
import TreeContext from "../common/TreeContext";

const useStyles = createStyles(
  (
    theme,
    {
      isCurrentVariation,
      color,
    }: { isCurrentVariation: boolean; color: string }
  ) => ({
    cell: {
      all: "unset",
      fontSize: 14,
      fontWeight: 600,
      display: "inline-block",
      padding: 6,
      borderRadius: 4,
      cursor: "pointer",
      color:
        color === "gray"
          ? theme.colorScheme === "dark"
            ? theme.white
            : theme.colors.gray[8]
          : theme.colors[color][6],
      backgroundColor: isCurrentVariation
        ? theme.fn.rgba(theme.colors[color][6], 0.2)
        : "transparent",
      "&:hover": {
        backgroundColor: theme.fn.rgba(
          theme.colors[color][6],
          isCurrentVariation ? 0.25 : 0.1
        ),
      },
    },
  })
);

function MoveCell({
  move,
  variation,
  annotation,
  comment,
  setTree,
  forceUpdate,
}: {
  move: string;
  variation: VariationTree;
  annotation: Annotation;
  comment: string;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
}) {
  const tree = useContext(TreeContext);
  const isCurrentVariation = variation.equals(tree);
  const color = annotationColor(annotation);
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

  function demoteVariation(variation: VariationTree) {
    const isCurrent = variation === tree;
    const parent = variation.parent;
    if (parent) {
      parent.children = [
        ...parent.children.filter((child) => child !== variation),
        variation,
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

  const { classes } = useStyles({ isCurrentVariation, color });

  return (
    <>
      <Box
        component="button"
        className={classes.cell}
        onClick={() => {
          setTree(variation);
        }}
      >
        {move + annotation}
      </Box>
    </>
  );
}

export default MoveCell;
