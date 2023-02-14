import { Box } from "@mantine/core";
import { VariationTree } from "../../utils/chess";
import MoveCell from "./MoveCell";

function CompleteMoveCell({
  tree,
  setTree,
  forceUpdate,
  first,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
  first?: boolean;
}) {
  const move_number = Math.ceil(tree.half_moves / 2);
  const is_white = tree.half_moves % 2 === 1;
  const hasNumber = tree.half_moves > 0 && (first || is_white);
  const lastMove = tree.move;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        marginLeft: hasNumber ? 6 : 0,
        fontSize: 14,
      }}
    >
      {hasNumber && <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>}
      {lastMove && (
        <MoveCell
          move={lastMove.san}
          variation={tree}
          setTree={setTree}
          annotation={tree.annotation}
          comment={tree.commentHTML}
          forceUpdate={forceUpdate}
        />
      )}
    </Box>
  );
}

export default CompleteMoveCell;