import { Box, Menu, Portal, TypographyStylesProvider } from "@mantine/core";
import { shallowEqual, useClickOutside } from "@mantine/hooks";
import { IconChevronUp, IconChevronsUp, IconFlag, IconX } from "@tabler/icons-react";
import { memo, useContext, useState } from "react";
import { Annotation } from "@/utils/chess";
import { TreeDispatchContext } from "../common/TreeStateContext";
import MoveCell from "./MoveCell";
import { useAtomValue } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";

function CompleteMoveCell({
  movePath,
  halfMoves,
  move,
  commentHTML,
  annotation,
  showComments,
  first,
  isCurrentVariation,
  isStart,
  targetRef,
}: {
  halfMoves: number;
  commentHTML: string;
  annotation: Annotation;
  showComments: boolean;
  move?: string;
  first?: boolean;
  isCurrentVariation: boolean;
  isStart: boolean;
  movePath: number[];
  targetRef: React.RefObject<HTMLSpanElement>;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const moveNumber = Math.ceil(halfMoves / 2);
  const isWhite = halfMoves % 2 === 1;
  const hasNumber = halfMoves > 0 && (first || isWhite);
  const ref = useClickOutside(() => {
    setOpen(false);
  });
  const [open, setOpen] = useState(false);
  const currentTab = useAtomValue(currentTabAtom);

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
          fontSize: "80%"
        }}
      >
        {hasNumber && <>{`${moveNumber.toString()}${isWhite ? "." : "..."}`}</>}
        {move && (
          <Menu opened={open} width={200}>
            <Menu.Target>
              <MoveCell
                ref={ref}
                move={move}
                annotation={annotation}
                isStart={isStart}
                isCurrentVariation={isCurrentVariation}
                onClick={() =>
                  dispatch({
                    type: "GO_TO_MOVE",
                    payload: movePath,
                  })
                }
                onContextMenu={(e: React.MouseEvent) => {
                  setOpen((v) => !v);
                  e.preventDefault();
                }}
              />
            </Menu.Target>

            <Portal>
              <Menu.Dropdown>
                {currentTab?.file?.metadata.type === "repertoire" && (
                  <Menu.Item
                    icon={<IconFlag size="0.875rem" />}
                    onClick={() => {
                      dispatch({
                        type: "SET_START",
                        payload: movePath,
                      });
                    }}
                  >
                    Mark as start
                  </Menu.Item>
                )}
                <Menu.Item
                  icon={<IconChevronsUp size="0.875rem" />}
                  onClick={() =>
                    dispatch({ type: "PROMOTE_TO_MAINLINE", payload: movePath })
                  }
                >
                  Promote to Main Line
                </Menu.Item>

                <Menu.Item
                  icon={<IconChevronUp size="0.875rem" />}
                  onClick={() =>
                    dispatch({ type: "PROMOTE_VARIATION", payload: movePath })
                  }
                >
                  Promote Variation
                </Menu.Item>

                <Menu.Item
                  color="red"
                  icon={<IconX size="0.875rem" />}
                  onClick={() =>
                    dispatch({ type: "DELETE_MOVE", payload: movePath })
                  }
                >
                  Delete Move
                </Menu.Item>
              </Menu.Dropdown>
            </Portal>
          </Menu>
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

export default memo(CompleteMoveCell, (prev, next) => {
  return (
    prev.move === next.move &&
    prev.commentHTML === next.commentHTML &&
    prev.annotation === next.annotation &&
    prev.showComments === next.showComments &&
    prev.first === next.first &&
    prev.isCurrentVariation === next.isCurrentVariation &&
    prev.isStart === next.isStart &&
    shallowEqual(prev.movePath, next.movePath) &&
    prev.halfMoves === next.halfMoves
  );
});
