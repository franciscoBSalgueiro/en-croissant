import { ActionIcon, Group } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useCallback, useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useStore } from "zustand";
import { keyMapAtom } from "@/state/keybinds";
import { TreeStateContext } from "./TreeStateContext";

function MoveControls({ readOnly }: { readOnly?: boolean }) {
  const store = useContext(TreeStateContext)!;
  const next = useStore(store, (s) => s.goToNext);
  const previous = useStore(store, (s) => s.goToPrevious);
  const start = useStore(store, (s) => s.goToStart);
  const end = useStore(store, (s) => s.goToEnd);
  const deleteMove = useStore(store, (s) => s.deleteMove);
  const startBranch = useStore(store, (s) => s.goToBranchStart);
  const endBranch = useStore(store, (s) => s.goToBranchEnd);
  const nextBranch = useStore(store, (s) => s.nextBranch);
  const previousBranch = useStore(store, (s) => s.previousBranch);
  const nextBranching = useStore(store, (s) => s.nextBranching);
  const previousBranching = useStore(store, (s) => s.previousBranching);
  const currentNode = useStore(store, (s) => s.currentNode());
  const practicePath = useStore(store, (s) => s.practicePath);
  const variationMenuOpened = useStore(store, (s) => s.variationMenuOpened);
  const openVariationMenu = useStore(store, (s) => s.openVariationMenu);
  const closeVariationMenu = useStore(store, (s) => s.closeVariationMenu);
  const moveVariationHighlight = useStore(store, (s) => s.moveVariationHighlight);
  const confirmVariationChoice = useStore(store, (s) => s.confirmVariationChoice);

  const hasVariations = currentNode.children.length > 1 && !practicePath;

  const handleNext = useCallback(() => {
    if (variationMenuOpened) {
      moveVariationHighlight(1);
    } else if (hasVariations) {
      openVariationMenu();
    } else {
      next();
    }
  }, [variationMenuOpened, hasVariations, moveVariationHighlight, openVariationMenu, next]);

  const handlePrevious = useCallback(() => {
    if (variationMenuOpened) {
      moveVariationHighlight(-1);
    } else {
      previous();
    }
  }, [variationMenuOpened, moveVariationHighlight, previous]);

  const handleBranchEnd = useCallback(() => {
    if (variationMenuOpened) {
      moveVariationHighlight(1);
    } else {
      endBranch();
    }
  }, [variationMenuOpened, moveVariationHighlight, endBranch]);

  const handleBranchStart = useCallback(() => {
    if (variationMenuOpened) {
      moveVariationHighlight(-1);
    } else {
      startBranch();
    }
  }, [variationMenuOpened, moveVariationHighlight, startBranch]);

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, handlePrevious);
  useHotkeys(keyMap.NEXT_MOVE.keys, handleNext);
  useHotkeys(keyMap.GO_TO_START.keys, start);
  useHotkeys(keyMap.GO_TO_END.keys, end);
  useHotkeys(keyMap.DELETE_MOVE.keys, readOnly ? () => {} : () => deleteMove());
  useHotkeys(keyMap.GO_TO_BRANCH_START.keys, handleBranchStart);
  useHotkeys(keyMap.GO_TO_BRANCH_END.keys, handleBranchEnd);
  useHotkeys(keyMap.NEXT_BRANCH.keys, nextBranch);
  useHotkeys(keyMap.PREVIOUS_BRANCH.keys, previousBranch);
  useHotkeys(keyMap.NEXT_BRANCHING.keys, nextBranching);
  useHotkeys(keyMap.PREVIOUS_BRANCHING.keys, previousBranching);
  useHotkeys("enter", () => variationMenuOpened && confirmVariationChoice());
  useHotkeys("escape", () => variationMenuOpened && closeVariationMenu());

  return (
    <Group grow gap="xs">
      <ActionIcon variant="default" size="lg" onClick={start}>
        <IconChevronsLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={handlePrevious}>
        <IconChevronLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={handleNext}>
        <IconChevronRight />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={end}>
        <IconChevronsRight />
      </ActionIcon>
    </Group>
  );
}

export default memo(MoveControls);
