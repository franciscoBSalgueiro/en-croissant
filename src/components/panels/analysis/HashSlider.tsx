import { commands } from "@/bindings";
import { formatBytes } from "@/utils/format";
import { Slider } from "@mantine/core";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";

export default function HashSlider({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const [tempValue, setTempValue] = useState(Math.log2(value));

  useEffect(() => {
    setTempValue(Math.log2(value));
  }, [value]);

  const { data: memorySize } = useSWRImmutable("memory", async () => {
    return await commands.memorySize() / 2;
  });

  return (
    <>
      <Slider
        min={0}
        max={Math.log2(memorySize || 16)}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={(v) => setValue(2 ** v)}
        label={(v) => formatBytes((2 ** v) * 1024 * 1024)}
      />
    </>
  );
}
