import { Badge } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { deckAtomFamily } from "@/state/atoms";
import { getStats } from "./opening";

// Next to a repertoire file: how many of its moves are due for practice or not seen yet
export function PracticeReminderBadge({ file, size }: { file: string; size: "xs" | "sm" }) {
  const [deck] = useAtom(
    deckAtomFamily({
      file,
      game: 0,
    }),
  );

  const stats = getStats(deck.positions);

  if (stats.due + stats.unseen === 0) return null;

  return (
    <Badge size={size} variant="light" color="orange" leftSection={<IconTarget size="0.75rem" />}>
      {stats.due + stats.unseen} due
    </Badge>
  );
}
