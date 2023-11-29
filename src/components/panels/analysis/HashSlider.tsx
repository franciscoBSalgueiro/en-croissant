import { commands } from "@/bindings";
import { formatBytes } from "@/utils/format";
import { Slider, rem } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { useStyles } from "./styles";

export default function HashSlider({
  value,
  setValue,
  color,
}: {
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const [tempValue, setTempValue] = useState(Math.log2(value));
  const { classes } = useStyles();

  useEffect(() => {
    setTempValue(Math.log2(value));
  }, [value]);

  const { data: memorySize } = useSWRImmutable("memory", async () => {
    return (await commands.memorySize()) / 2;
  });

  return (
    <>
      <Slider
        min={0}
        max={Math.log2(memorySize || 16)}
        color={color}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={(v) => setValue(2 ** v)}
        label={(v) => formatBytes(2 ** v * 1024 * 1024)}
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
