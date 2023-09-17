import { NumberInput } from "@mantine/core";
import { PrimitiveAtom, useAtom } from "jotai";

export default function SettingsNumberInput({
    atom,
    min,
    max,
    step,
}: {
    atom: PrimitiveAtom<number>;
    min: number;
    max?: number;
    step?: number;
}) {
    const [value, setValue] = useAtom(atom);
    return <NumberInput
        value={value}
        onChange={(value) => setValue(value || min)}
        min={min}
        max={max}
        step={step}
    />
}