import { Slider } from "@mantine/core";
import { useState } from "react";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [tempValue, setTempValue] = useState(value);
  const MARKS = [
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
  ];

  return (
    <>
      <Slider
        min={1}
        max={5}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={setValue}
        marks={MARKS}
      />
    </>
  );
}
