import { Comment } from "@/components/common/Comment";
import { currentTabAtom } from "@/state/atoms";
import type { Annotation } from "@/utils/annotation";
import { hasMorePriority, stripClock } from "@/utils/chess";
import { type TreeNode, treeIterator } from "@/utils/treeReducer";
import { ActionIcon, Box, Menu, Portal, Tooltip } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import {
  IconArrowsJoin,
  IconChevronUp,
  IconChevronsUp,
  IconCopy,
  IconFlag,
  IconX,
} from "@tabler/icons-react";
import equal from "fast-deep-equal";
import { useAtomValue } from "jotai";
import { memo, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import MoveCell from "./MoveCell";
import { TreeStateContext } from "./TreeStateContext";

function getTranspositions(fen: string, position: number[], root: TreeNode) {
  if (position.length === 0 || position.every((v) => v === 0)) return [];
  const transpositions: number[][] = [];
  const strippedFen = stripClock(fen);
  const iterator = treeIterator(root);
  for (const item of iterator) {
    if (hasMorePriority(position, item.position)) {
      continue;
    }
    if (stripClock(item.node.fen) === strippedFen) {
      transpositions.push(item.position);
    }
  }
  return transpositions;
}

function CompleteMoveCell({
  movePath,
  halfMoves,
  move,
  fen,
  comment,
  annotations,
  showComments,
  first,
  isStart,
  targetRef,
}: {
  halfMoves: number;
  comment: string;
  annotations: Annotation[];
  showComments: boolean;
  move?: string | null;
  fen?: string;
  first?: boolean;
  isStart: boolean;
  movePath: number[];
  targetRef: React.RefObject<HTMLSpanElement>;
}) {
  const store = useContext(TreeStateContext)!;
  const isCurrentVariation = useStore(store, (s) =>
    equal(s.position, movePath),
  );
  const root = useStore(store, (s) => s.root);
  const goToMove = useStore(store, (s) => s.goToMove);
  const deleteMove = useStore(store, (s) => s.deleteMove);
  const promoteVariation = useStore(store, (s) => s.promoteVariation);
  const promoteToMainline = useStore(store, (s) => s.promoteToMainline);
  const copyVariationPgn = useStore(store, (s) => s.copyVariationPgn);
  const setStart = useStore(store, (s) => s.setStart);

  const moveNumber = Math.ceil(halfMoves / 2);
  const isWhite = halfMoves % 2 === 1;
  const hasNumber = halfMoves > 0 && (first || isWhite);
  const ref = useClickOutside(() => {
    setOpen(false);
  });
  const [open, setOpen] = useState(false);
  const currentTab = useAtomValue(currentTabAtom);

  const transpositions = fen ? getTranspositions(fen, movePath, root) : [];
  const { t } = useTranslation();

  return (
    <>
      <Box
        ref={isCurrentVariation ? targetRef : undefined}
        component="span"
        style={{
          display: "inline-block",
          marginLeft: hasNumber ? 6 : 0,
          fontSize: "80%",
        }}
      >
        {hasNumber && `${moveNumber.toString()}${isWhite ? "." : "..."}`}
        {move && (
          <Menu opened={open} width={200}>
            <Menu.Target>
              <MoveCell
                ref={ref}
                move={move}
                annotations={annotations}
                isStart={isStart}
                isCurrentVariation={isCurrentVariation}
                onClick={() => goToMove(movePath)}
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
                    leftSection={<IconFlag size="0.875rem" />}
                    onClick={() => setStart(movePath)}
                  >
                    {t("Menu.MarkAsStart")}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconChevronsUp size="0.875rem" />}
                  onClick={() => promoteToMainline(movePath)}
                >
                  {t("Menu.PromoteToMainLine")}
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconChevronUp size="0.875rem" />}
                  onClick={() => promoteVariation(movePath)}
                >
                  {t("Menu.PromoteVariation")}
                </Menu.Item>

                <Menu.Item
                  leftSection={<IconCopy size="0.875rem" />}
                  onClick={() => copyVariationPgn(movePath)}
                >
                  {t("Menu.CopyVariationPGN")}
                </Menu.Item>

                <Menu.Item
                  color="red"
                  leftSection={<IconX size="0.875rem" />}
                  onClick={() => deleteMove(movePath)}
                >
                  {t("Menu.DeleteMove")}
                </Menu.Item>
              </Menu.Dropdown>
            </Portal>
          </Menu>
        )}
        {transpositions.length > 0 && (
          <Tooltip label="Transposition">
            <ActionIcon size="xs" onClick={() => goToMove(transpositions[0])}>
              <IconArrowsJoin size="0.875rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>
      {showComments && comment && <Comment comment={comment} />}
    </>
  );
}

export default memo(CompleteMoveCell, (prev, next) => {
  return (
    prev.move === next.move &&
    prev.fen === next.fen &&
    prev.comment === next.comment &&
    equal(prev.annotations, next.annotations) &&
    prev.showComments === next.showComments &&
    prev.first === next.first &&
    prev.isStart === next.isStart &&
    equal(prev.movePath, next.movePath) &&
    prev.halfMoves === next.halfMoves
  );
});
