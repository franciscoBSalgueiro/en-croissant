import { Box, TypographyStylesProvider } from "@mantine/core";
import { memo } from "react";
import { Annotation, VariationTree } from "../../utils/chess";
import MoveCell from "./MoveCell";

function CompleteMoveCell({
  tree,
  halfMoves,
  move,
  commentHTML,
  setTree,
  annotation,
  showComments,
  first,
  isCurrentVariation,
  targetRef,
}: {
  tree: VariationTree;
  halfMoves: number;
  commentHTML: string;
  annotation: Annotation;
  setTree: (tree: VariationTree) => void;
  showComments: boolean;
  move?: string;
  first?: boolean;
  isCurrentVariation: boolean;
  targetRef: React.RefObject<HTMLSpanElement>;
}) {
  const move_number = Math.ceil(halfMoves / 2);
  const is_white = halfMoves % 2 === 1;
  const hasNumber = halfMoves > 0 && (first || is_white);

  const multipleLine =
    commentHTML.split("</p>").length - 1 > 1 ||
    commentHTML.includes("<blockquote>") ||
    commentHTML.includes("<ul>") ||
    commentHTML.includes("<h");

  return (
    <>
      <Box
        ref={isCurrentVariation ? targetRef : undefined}
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
        {move && (
          <MoveCell
            move={move}
            annotation={annotation}
            comment={commentHTML}
            isCurrentVariation={isCurrentVariation}
            onClick={() => setTree(tree)}
          />
        )}
      </Box>
      {showComments && commentHTML && (
        <TypographyStylesProvider
          style={{
            display: multipleLine ? "block" : "inline-block",
            marginLeft: 4,
            marginRight: 4,
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: commentHTML,
            }}
          />
        </TypographyStylesProvider>
      )}
    </>
  );
}

export default memo(CompleteMoveCell);
