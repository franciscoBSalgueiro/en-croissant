import { keyMapAtom } from "@/atoms/keybinds";
import { ActionIcon, Group } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { memo, useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { TreeDispatchContext } from "./TreeStateContext";

function MoveControls({
  goToStart,
  goToEnd,
  goToPrevious,
  goToNext,
}: {
  goToStart?: () => void;
  goToEnd?: () => void;
  goToPrevious?: () => void;
  goToNext?: () => void;
}) {
  const dispatch = useContext(TreeDispatchContext);
  const handleGoToStart =
    goToStart ?? (() => dispatch({ type: "GO_TO_START" }));
  const handleGoToEnd = goToEnd ?? (() => dispatch({ type: "GO_TO_END" }));
  const handleGoToPrevious =
    goToPrevious ?? (() => dispatch({ type: "GO_TO_PREVIOUS" }));
  const handleGoToNext = goToNext ?? (() => dispatch({ type: "GO_TO_NEXT" }));
  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, handleGoToPrevious);
  useHotkeys(keyMap.NEXT_MOVE.keys, handleGoToNext);
  useHotkeys(keyMap.GO_TO_START.keys, handleGoToStart);
  useHotkeys(keyMap.GO_TO_END.keys, handleGoToEnd);
  useHotkeys(keyMap.DELETE_MOVE.keys, () => dispatch({ type: "DELETE_MOVE" }));
  return (
    <Group grow>
      <ActionIcon variant="default" size="xl" onClick={handleGoToStart}>
        <IconChevronsLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="xl" onClick={handleGoToPrevious}>
        <IconChevronLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="xl" onClick={handleGoToNext}>
        <IconChevronRight />
      </ActionIcon>
      <ActionIcon variant="default" size="xl" onClick={handleGoToEnd}>
        <IconChevronsRight />
      </ActionIcon>
    </Group>
  );
}

export default memo(MoveControls);
