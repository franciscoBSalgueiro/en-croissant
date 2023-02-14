import { Box, TypographyStylesProvider } from "@mantine/core";
import { VariationTree } from "../../utils/chess";
import MoveCell from "./MoveCell";

function CompleteMoveCell({
  tree,
  setTree,
  forceUpdate,
  showComments,
  first,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
  showComments: boolean;
  first?: boolean;
}) {
  const move_number = Math.ceil(tree.half_moves / 2);
  const is_white = tree.half_moves % 2 === 1;
  const hasNumber = tree.half_moves > 0 && (first || is_white);
  const lastMove = tree.move;

  const multipleLine =
    tree.commentHTML.split("</p>").length - 1 > 1 ||
    tree.commentHTML.includes("<blockquote>") ||
    tree.commentHTML.includes("<ul>") ||
    tree.commentHTML.includes("<h");

  return (
    <>
      <Box
        component="span"
        sx={{
          display: "inline-block",
          marginLeft: hasNumber ? 6 : 0,
          fontSize: 14,
        }}
      >
        {hasNumber && (
          <>{`${move_number.toString()}${is_white ? "." : "..."}`}</>
        )}
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
      {showComments && tree.commentHTML && (
        <TypographyStylesProvider
          style={{
            display: multipleLine ? "block" : "inline-block",
            marginLeft: 4,
            marginRight: 4,
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: tree.commentHTML,
            }}
          />
        </TypographyStylesProvider>
      )}
    </>
  );
}

export default CompleteMoveCell;
