import type { GoMode } from "@/bindings";
import { NumberInput, Select } from "@mantine/core";
import { atom, useAtom } from "jotai";
import { atomFamily } from "jotai/utils";
import { match } from "ts-pattern";

type TimeType = "ms" | "s" | "m" | "h";
export const timeTypeFamily = atomFamily((def: TimeType) =>
  atom<TimeType>(def),
);

function TimeInput({
  value,
  setValue,
  defaultType,
}: { value: number; setValue: (v: GoMode) => void; defaultType?: TimeType }) {
  const [timeType, setTimeType] = useAtom(timeTypeFamily(defaultType ?? "ms"));
  const displayedValue = match(timeType)
    .with("ms", () => value)
    .with("s", () => value / 1000)
    .with("m", () => value / 1000 / 60)
    .with("h", () => value / 1000 / 60 / 60)
    .exhaustive();

  return (
    <NumberInput
      min={0}
      decimalScale={2}
      allowDecimal={false}
      hideControls
      rightSection={
        <Select
          withCheckIcon={false}
          data={["ms", "s", "m", "h"]}
          defaultValue="ms"
          allowDeselect={false}
          value={timeType}
          withScrollArea={false}
          onChange={(v) => setTimeType(v as TimeType)}
          styles={{
            option: {
              wordBreak: "keep-all",
              overflow: "hidden",
            },
          }}
        />
      }
      rightSectionWidth={"30%"}
      value={displayedValue}
      onChange={(v) =>
        // setValue({ t: "Time", c: typeof v === "number" ? v : 1 })
        setValue({
          t: "Time",
          c:
            typeof v === "number"
              ? Math.round(
                  match(timeType)
                    .with("ms", () => v)
                    .with("s", () => v * 1000)
                    .with("m", () => v * 1000 * 60)
                    .with("h", () => v * 1000 * 60 * 60)
                    .exhaustive(),
                )
              : 1,
        })
      }
    />
  );
}

export default TimeInput;
