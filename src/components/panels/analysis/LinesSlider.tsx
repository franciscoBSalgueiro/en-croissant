import {
  MantineStyleProps,
  SegmentedControl,
  useMantineTheme,
} from "@mantine/core";

export default function DepthSlider(
  props: {
    value: number;
    setValue: (v: number) => void;
    color?: string;
  } & MantineStyleProps,
) {
  const theme = useMantineTheme();

  return (
    <SegmentedControl
      {...props}
      size="xs"
      color={props.color || theme.primaryColor}
      data={["1", "2", "3", "4", "5"]}
      value={props.value.toString()}
      onChange={(v) => props.setValue(parseInt(v))}
    />
  );
}
