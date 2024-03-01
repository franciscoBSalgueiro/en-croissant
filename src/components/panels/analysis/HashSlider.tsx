import { commands } from "@/bindings";
import { formatBytes } from "@/utils/format";
import { Slider, rem } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";

export default function HashSlider(props: {
  value: number;
  setValue: (v: number) => void;
  color?: string;
}) {
  const [tempValue, setTempValue] = useState(Math.log2(props.value));

  useEffect(() => {
    setTempValue(Math.log2(props.value));
  }, [props.value]);

  const { data: memorySize } = useSWRImmutable("memory", async () => {
    return (await commands.memorySize()) / 2;
  });

  return (
    <>
      <Slider
        min={0}
        max={Math.log2(memorySize || 16)}
        color={props.color}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={(v) => props.setValue(2 ** v)}
        label={(v) => formatBytes(2 ** v * 1024 * 1024)}
        thumbChildren={
          <IconGripVertical
            style={{ width: rem(20), height: rem(20) }}
            stroke={1.5}
          />
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
