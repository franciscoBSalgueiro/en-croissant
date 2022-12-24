import { Slider } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

export default function CoresSlide({
  value,
  setValue,
}: {
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [tempValue, setTempValue] = useState(value);
  const [debounced] = useDebouncedValue(tempValue, 200);
  const MARKS = [
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
    { value: 6 },
  ];

  useEffect(() => setValue(debounced), [debounced, setValue]);

  return (
    <>
      <Slider
        min={0}
        max={6}
        value={tempValue}
        onChange={setTempValue}
        marks={MARKS}
        label={(value) => 2 ** value}
      />
    </>
  );
}
