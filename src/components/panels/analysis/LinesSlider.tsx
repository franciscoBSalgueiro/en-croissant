import { Slider } from "@mantine/core";
import { useEffect, useState } from "react";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const [tempValue, setTempValue] = useState(value);
  const MARKS = [
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
  ];

  useEffect(() => {
    setTempValue(value);
  }, [value]);

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
