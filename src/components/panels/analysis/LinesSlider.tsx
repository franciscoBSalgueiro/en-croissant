import { SegmentedControl, useMantineTheme } from "@mantine/core";

export default function LinesSlider(props: {
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const theme = useMantineTheme();

  return (
    <SegmentedControl
      size="xs"
      color={props.color || theme.primaryColor}
      data={["1", "2", "3", "4", "5"]}
      value={props.value.toString()}
      onChange={(v) => props.setValue(Number.parseInt(v))}
    />
  );
}
