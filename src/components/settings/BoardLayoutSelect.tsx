import { Select } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { type BoardLayout, boardLayoutAtom } from "@/state/atoms";

export default function BoardLayoutSelect() {
  const { t } = useTranslation();
  const [boardLayout, setBoardLayout] = useAtom(boardLayoutAtom);

  return (
    <Select
      allowDeselect={false}
      data={[
        { value: "auto", label: t("Settings.Appearance.BoardLayout.Auto") },
        { value: "sideBySide", label: t("Settings.Appearance.BoardLayout.SideBySide") },
        { value: "stacked", label: t("Settings.Appearance.BoardLayout.Stacked") },
      ]}
      value={boardLayout}
      onChange={(val) => setBoardLayout(val as BoardLayout)}
    />
  );
}
