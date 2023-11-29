import { GoMode } from "@/bindings";
import { Slider, rem } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useStyles } from "./styles";

export default function DepthSlider({
  value,
  setValue,
  color,
}: {
  value: GoMode;
  setValue: (v: GoMode) => void;
  color?: string;
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
  const { classes } = useStyles();

  useEffect(() => {
    setTempValue(value);
  }, [value]);

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
        color={color}
        label={(v) => (v === 60 ? "Infinite" : v)}
        onChange={(v) => handleSliderChange(v, setTempValue)}
        onChangeEnd={(v) => handleSliderChange(v, setValue)}
        marks={MARKS}
        thumbChildren={
          <IconGripVertical
            style={{ width: rem(20), height: rem(20) }}
            stroke={1.5}
          />
        }
        classNames={classes}
      />
    </>
  );
}
