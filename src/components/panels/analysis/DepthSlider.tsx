import { Slider } from "@mantine/core";
import { useState } from "react";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const [tempValue, setTempValue] = useState(value);
  const MARKS = [
    { value: 10 },
    { value: 20 },
    { value: 30 },
    { value: 40 },
    { value: 50 },
    { value: 60 },
  ];

  return (
    <>
      <Slider
        min={10}
        max={60}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={setValue}
        marks={MARKS}
      />
    </>
  );
}
