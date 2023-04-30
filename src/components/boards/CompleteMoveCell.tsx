import { Box, TypographyStylesProvider } from "@mantine/core";
import { memo } from "react";
import { VariationTree } from "../../utils/chess";
import MoveCell from "./MoveCell";

function CompleteMoveCell({
  tree,
  setTree,
  showComments,
  first,
  isCurrentVariation,
}: {
  tree: VariationTree;
  setTree: (tree: VariationTree) => void;
  showComments: boolean;
  first?: boolean;
  isCurrentVariation: boolean;
}) {
  const move_number = Math.ceil(tree.halfMoves / 2);
  const is_white = tree.halfMoves % 2 === 1;
  const hasNumber = tree.halfMoves > 0 && (first || is_white);
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
            annotation={tree.annotation}
            comment={tree.commentHTML}
            isCurrentVariation={isCurrentVariation}
            onClick={() => setTree(tree)}
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

export default memo(CompleteMoveCell);
