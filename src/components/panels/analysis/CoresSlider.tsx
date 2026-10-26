import { SegmentedControl, useMantineTheme } from "@mantine/core";

export default function CoresSlider(props: {
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const theme = useMantineTheme();
  const values = Array.from(
    { length: Math.floor(Math.log2(navigator.hardwareConcurrency)) + 1 },
    (_, i) => 2 ** i,
  );

  if (props.value > 0 && !values.includes(props.value)) {
    values.push(props.value);
    values.sort((a, b) => a - b);
  }

  return (
    <SegmentedControl
      size="xs"
      color={props.color || theme.primaryColor}
      value={props.value.toString()}
      onChange={(v) => props.setValue(Number.parseInt(v))}
      data={values.map((v) => v.toString())}
    />
  );
}
