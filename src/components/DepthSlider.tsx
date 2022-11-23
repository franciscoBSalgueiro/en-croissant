import { Slider } from "@mantine/core";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const MARKS = [
    { value: 10, label: "10" },
    { value: 20, label: "20" },
    { value: 30, label: "30" },
    { value: 40, label: "40" },
    { value: 50, label: "50" },
    { value: 60, label: "60" },
  ];

  return (
    <>
      <Slider
        min={10}
        max={60}
        size="lg"
        value={value}
        onChange={setValue}
        marks={MARKS}
      />
    </>
  );
}
