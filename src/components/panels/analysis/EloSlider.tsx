import { rem, Slider } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useState } from "react";

export default function EloSlider(props: {
  minElo: number;
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const [tempValue, setTempValue] = useState(props.value);

  return (
    <>
      <Slider
        min={props.minElo}
        max={props.value}
        color={props.color}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={(v) => props.setValue(v)}
        label={(v) => v}
        thumbChildren={
          <IconGripVertical style={{ width: rem(20), height: rem(20) }} stroke={1.5} />
        }
        styles={(theme) => ({
          mark: {
            display: "flex",
          },
          thumb: {
            width: rem(20),
            height: rem(20),
            backgroundColor: theme.white,
            color: theme.colors.gray[5],
            border: `1px solid ${theme.colors.gray[2]}`,
          },
        })}
      />
    </>
  );
}
