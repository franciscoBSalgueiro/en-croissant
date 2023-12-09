import { Select } from "@mantine/core";
import { PrimitiveAtom, useAtom } from "jotai";

export default function SettingsSelect({
  atom,
  data,
  placeholder,
}: {
  atom: PrimitiveAtom<string>;
  data: { label: string; value: string }[];
  placeholder: string;
}) {
  const [value, setValue] = useAtom(atom);
  return (
    <Select
      allowDeselect={false}
      data={data}
      value={value}
      onChange={(v) => setValue(v!)}
      placeholder={placeholder}
    />
  );
}
