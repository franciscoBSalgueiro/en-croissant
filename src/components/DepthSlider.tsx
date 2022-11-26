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
  const MARKS = [
    { value: 10, label: "10" },
    { value: 20, label: "20" },
    { value: 30, label: "30" },
    { value: 40, label: "40" },
    { value: 50, label: "50" },
    { value: 60, label: "60" },
  ];
  
  useEffect(
    () => setValue(debounced),
    [debounced, setValue]
  )

  return (
    <>
      <Slider
        min={10}
        max={60}
        size="lg"
        value={tempValue}
        onChange={setTempValue}
        marks={MARKS}
      />
    </>
  );
}
