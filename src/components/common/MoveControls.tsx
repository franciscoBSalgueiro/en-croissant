import { ActionIcon, Group } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { memo, useContext } from "react";
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
  useHotkeys([
    ["ArrowLeft", handleGoToPrevious],
    ["ArrowRight", handleGoToNext],
    ["ArrowUp", handleGoToStart],
    ["ArrowDown", handleGoToEnd],
    ["Delete", () => dispatch({ type: "DELETE_MOVE" })],
  ]);
  return (
    <Group grow>
      <ActionIcon variant="light" size="xl" onClick={handleGoToStart}>
        <IconChevronsLeft />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={handleGoToPrevious}>
        <IconChevronLeft />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={handleGoToNext}>
        <IconChevronRight />
      </ActionIcon>
      <ActionIcon variant="light" size="xl" onClick={handleGoToEnd}>
        <IconChevronsRight />
      </ActionIcon>
    </Group>
  );
}

export default memo(MoveControls);
