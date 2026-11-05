import { Badge, Tooltip } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { deckAtomFamily, showPracticeReminderBadgesAtom } from "@/state/atoms";
import { getStats } from "./opening";

// Next to a repertoire file: how many moves Start Practice would ask now (due and unseen)
export function PracticeReminderBadge({ file, size }: { file: string; size: "xs" | "sm" }) {
  const { t } = useTranslation();
  const show = useAtomValue(showPracticeReminderBadgesAtom);
  const [deck] = useAtom(
    deckAtomFamily({
      file,
      game: 0,
    }),
  );

  if (!show) return null;

  const stats = getStats(deck.positions);

  if (stats.due + stats.unseen === 0) return null;

  return (
    <Tooltip
      label={`${t("Board.Practice.Due")}: ${stats.due} · ${t("Board.Practice.Unseen")}: ${stats.unseen}`}
    >
      <Badge
        size={size}
        variant="light"
        leftSection={<IconTarget size={size === "xs" ? 10 : "0.75rem"} />}
      >
        {stats.due + stats.unseen}
      </Badge>
    </Tooltip>
  );
}
