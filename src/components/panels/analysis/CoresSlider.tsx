import { SegmentedControl, useMantineTheme } from "@mantine/core";

export default function CoresSlide({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const theme = useMantineTheme();
  const values = Array.from(
    { length: Math.log2(navigator.hardwareConcurrency) + 1 },
    (_, i) => 2 ** i
  );

  return (
    <SegmentedControl
      size="xs"
      color={theme.primaryColor}
      value={value.toString()}
      onChange={(v) => setValue(parseInt(v))}
      data={values.map((v) => v.toString())}
    />
  );
}
