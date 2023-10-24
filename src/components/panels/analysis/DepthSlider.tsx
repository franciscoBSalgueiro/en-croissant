import { GoMode } from "@/bindings";
import { Slider } from "@mantine/core";
import { useState } from "react";

export default function DepthSlider({
  value,
  setValue,
}: {
  value: GoMode;
  setValue: (v: GoMode) => void;
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

  const v = tempValue.t === "Infinite" ? 60 : tempValue.c;
  const handleSliderChange = (v: number, setState: (v: GoMode) => void) => {
    if (v === 60) {
      setState({
        t: "Infinite",
      });
    } else {
      setState({
        t: "Depth",
        c: v,
      });
    }
  };

  return (
    <>
      <Slider
        min={10}
        max={60}
        value={v}
        label={(v) => (v === 60 ? "Infinite" : v)}
        onChange={(v) => handleSliderChange(v, setTempValue)}
        onChangeEnd={(v) => handleSliderChange(v, setValue)}
        marks={MARKS}
      />
    </>
  );
}
