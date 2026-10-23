import { Tooltip as MTTooltip, Progress } from "@mantine/core";
import { useTranslation } from "react-i18next";

function ResultsChart({
  won,
  draw,
  lost,
  size,
}: {
  won: number;
  draw: number;
  lost: number;
  size: string;
}) {
  const { t } = useTranslation();
  const total = won + draw + lost || 1;
  return (
    <Progress.Root size={size}>
      <MTTooltip label={t("Home.Personal.WinCount", { count: won })}>
        <Progress.Section value={(won / total) * 100} color="teal.5" />
      </MTTooltip>

      <MTTooltip label={t("Home.Personal.DrawCount", { count: draw })}>
        <Progress.Section value={(draw / total) * 100} color="gray.6" />
      </MTTooltip>

      <MTTooltip label={t("Home.Personal.LossCount", { count: lost })}>
        <Progress.Section value={(lost / total) * 100} color="red.4" />
      </MTTooltip>
    </Progress.Root>
  );
}

export default ResultsChart;
