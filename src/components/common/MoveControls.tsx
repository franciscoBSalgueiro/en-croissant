import { keyMapAtom } from "@/state/keybinds";
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
import { useStore } from "zustand";
import { TreeStateContext } from "./TreeStateContext";

function MoveControls({
  readOnly,
}: {
  readOnly?: boolean;
}) {
  const store = useContext(TreeStateContext)!;
  const next = useStore(store, (s) => s.goToNext);
  const previous = useStore(store, (s) => s.goToPrevious);
  const start = useStore(store, (s) => s.goToStart);
  const end = useStore(store, (s) => s.goToEnd);
  const deleteMove = useStore(store, (s) => s.deleteMove);

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.PREVIOUS_MOVE.keys, previous);
  useHotkeys(keyMap.NEXT_MOVE.keys, next);
  useHotkeys(keyMap.GO_TO_START.keys, start);
  useHotkeys(keyMap.GO_TO_END.keys, end);
  useHotkeys(keyMap.DELETE_MOVE.keys, readOnly ? () => {} : () => deleteMove());
  return (
    <Group grow gap="xs">
      <ActionIcon variant="default" size="lg" onClick={start}>
        <IconChevronsLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={previous}>
        <IconChevronLeft />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={next}>
        <IconChevronRight />
      </ActionIcon>
      <ActionIcon variant="default" size="lg" onClick={end}>
        <IconChevronsRight />
      </ActionIcon>
    </Group>
  );
}

export default memo(MoveControls);
