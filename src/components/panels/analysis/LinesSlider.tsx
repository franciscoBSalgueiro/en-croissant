import { SegmentedControl, useMantineTheme } from "@mantine/core";

export default function DepthSlider({
  value,
  setValue,
  color,
}: {
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const theme = useMantineTheme();

  return (
    <SegmentedControl
      size="xs"
      color={color || theme.primaryColor}
      data={["1", "2", "3", "4", "5"]}
      value={value.toString()}
      onChange={(v) => setValue(parseInt(v))}
    />
  );
}
