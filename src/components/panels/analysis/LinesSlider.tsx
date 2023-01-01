import { Slider } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [tempValue, setTempValue] = useState(value);
  const [debounced] = useDebouncedValue(tempValue, 200)
  useEffect(
    () => setValue(debounced),
    [debounced, setValue]
  )
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
        marks={MARKS}
      />
    </>
  );
}
