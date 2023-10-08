import { Slider } from "@mantine/core";
import { useState } from "react";

export default function CoresSlide({
  value,
  setValue,
}: {
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [tempValue, setTempValue] = useState(value);
  const MARKS = [
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
    { value: 6 },
  ];

  return (
    <>
      <Slider
        min={0}
        max={Math.log2(navigator.hardwareConcurrency)}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={setValue}
        marks={MARKS}
        label={(value) => 2 ** value}
      />
    </>
  );
}
