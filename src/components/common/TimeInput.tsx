import { GoMode } from "@/bindings";
import { NumberInput, Select } from "@mantine/core";
import { useState } from "react";
import { match } from "ts-pattern";

type TimeType = "ms" | "s" | "m" | "h";
function TimeInput({
  value,
  setValue,
}: { value: number; setValue: (v: GoMode) => void }) {
  const [timeType, setTimeType] = useState<TimeType>("ms");
  const displayedValue = match(timeType)
    .with("ms", () => value)
    .with("s", () => value / 1000)
    .with("m", () => value / 1000 / 60)
    .with("h", () => value / 1000 / 60 / 60)
    .exhaustive();

  return (
    <NumberInput
      min={1}
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
          onChange={(v) => setTimeType(v as TimeType)}
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
