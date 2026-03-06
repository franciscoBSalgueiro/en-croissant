import { Tooltip as MTTooltip, Progress } from "@mantine/core";

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
  const total = won + draw + lost;
  return (
    <Progress.Root size={size}>
      <MTTooltip label={`${won} wins`}>
        <Progress.Section value={(won / total) * 100} color="green">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {won / total > 0.15
              ? `${((won / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={`${draw} draws`}>
        <Progress.Section value={(draw / total) * 100} color="gray">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {draw / total > 0.15
              ? `${((draw / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>

      <MTTooltip label={`${lost} losses`}>
        <Progress.Section value={(lost / total) * 100} color="red">
          <Progress.Label style={{ textOverflow: "clip" }}>
            {lost / total > 0.15
              ? `${((lost / total) * 100).toFixed(1)}%`
              : undefined}
          </Progress.Label>
        </Progress.Section>
      </MTTooltip>
    </Progress.Root>
  );
}

export default ResultsChart;
