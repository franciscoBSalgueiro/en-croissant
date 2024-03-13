import { Switch } from "@mantine/core";
import { type PrimitiveAtom, useAtom } from "jotai";

export default function SettingsSwitch({
  atom,
}: {
  atom: PrimitiveAtom<boolean>;
}) {
  const [checked, setChecked] = useAtom(atom);
  return (
    <Switch
      onLabel="ON"
      offLabel="OFF"
      size="lg"
      checked={checked}
      onChange={(event) => setChecked(event.currentTarget.checked)}
      styles={{
        track: { cursor: "pointer" },
      }}
    />
  );
}
