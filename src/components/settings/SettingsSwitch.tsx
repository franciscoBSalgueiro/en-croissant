import { Switch } from "@mantine/core";
import { type PrimitiveAtom, useAtom } from "jotai";
import { useTranslation } from "react-i18next";

export default function SettingsSwitch({
  atom,
}: {
  atom: PrimitiveAtom<boolean>;
}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useAtom(atom);
  return (
    <Switch
      onLabel={t("Common.On")}
      offLabel={t("Common.Off")}
      size="lg"
      checked={checked}
      onChange={(event) => setChecked(event.currentTarget.checked)}
      styles={{
        track: { cursor: "pointer" },
      }}
    />
  );
}
