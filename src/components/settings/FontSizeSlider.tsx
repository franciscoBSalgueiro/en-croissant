import { fontSizeAtom } from "@/state/atoms";
import { Slider } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";

export default function FontSizeSlider() {
  const [fontSize, setFontSize] = useAtom(fontSizeAtom);
  const [tempFontSize, setTempFontSize] = useState(fontSize);

  useEffect(() => {
    setTempFontSize(fontSize);
  }, [fontSize]);

  return (
    <Slider
      min={50}
      max={200}
      step={10}
      value={tempFontSize}
      w="15rem"
      onChange={(value) => {
        setTempFontSize(value as number);
      }}
      onChangeEnd={setFontSize}
      marks={["50%", "100%", "150%", "200%"].map((label) => ({
        value: Number.parseInt(label),
        label,
      }))}
    />
  );
}
