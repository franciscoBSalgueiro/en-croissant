import { Tooltip as MTTooltip, Progress } from "@mantine/core";
import { useTranslation } from "react-i18next";

function ResultsChart({
  won,
  draw,
  lost,
  size,
  showLabels = false,
}: {
  won: number;
  draw: number;
  lost: number;
  size: string;
  showLabels?: boolean;
}) {
  const { t } = useTranslation();
  const total = won + draw + lost || 1;
  return (
    <Progress.Root size={size}>
      <MTTooltip label={t("Home.Personal.WinCount", { count: won })}>
        <Progress.Section value={(won / total) * 100} color={showLabels ? "green" : "teal.5"}>
          {showLabels && won / total >= 0.15 && (
            <Progress.Label>{((won / total) * 100).toFixed(1)}%</Progress.Label>
          )}
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={t("Home.Personal.DrawCount", { count: draw })}>
        <Progress.Section value={(draw / total) * 100} color="gray.6">
          {showLabels && draw / total >= 0.15 && (
            <Progress.Label>{((draw / total) * 100).toFixed(1)}%</Progress.Label>
          )}
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={t("Home.Personal.LossCount", { count: lost })}>
        <Progress.Section value={(lost / total) * 100} color={showLabels ? "red" : "red.4"}>
          {showLabels && lost / total >= 0.15 && (
            <Progress.Label>{((lost / total) * 100).toFixed(1)}%</Progress.Label>
          )}
        </Progress.Section>
      </MTTooltip>
    </Progress.Root>
  );
}

export default ResultsChart;
