import { ActionIcon, Group } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";

interface MoveControlsProps {
  goToStart: () => void;
  goToEnd: () => void;
  redoMove: () => void;
  undoMove: () => void;
}

function MoveControls({
  goToStart,
  goToEnd,
  redoMove,
  undoMove,
}: MoveControlsProps) {
  return (
    <Group grow>
      <ActionIcon variant="light" size="xl" onClick={() => goToStart()}>
        <IconChevronsLeft />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={() => undoMove()}>
        <IconChevronLeft />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={() => redoMove()}>
        <IconChevronRight />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={() => goToEnd()}>
        <IconChevronsRight />
      </ActionIcon>
    </Group>
  );
}

export default MoveControls;
