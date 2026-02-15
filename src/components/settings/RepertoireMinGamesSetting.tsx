import { coverageMinGamesAtom } from "@/state/atoms";
import { Group, NumberInput, Select } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function RepertoireMinGamesSetting() {
  const { t } = useTranslation();
  const [minGames, setMinGames] = useAtom(coverageMinGamesAtom);
  const [preset, setPreset] = useState<
    "standard" | "essential" | "deep" | "custom"
  >(
    minGames === 50
      ? "standard"
      : minGames === 20
        ? "deep"
        : minGames === 200
          ? "essential"
          : "custom",
  );

  useEffect(() => {
    if (minGames === 50) setPreset("standard");
    else if (minGames === 20) setPreset("deep");
    else if (minGames === 200) setPreset("essential");
    else setPreset("custom");
  }, [minGames]);

  return (
    <Group wrap="nowrap">
      <Select
        w={200}
        allowDeselect={false}
        data={[
          {
            value: "essential",
            label: `${t("Settings.Repertoire.Essential")} (200)`,
          },
          {
            value: "standard",
            label: `${t("Settings.Repertoire.Standard")} (50)`,
          },
          { value: "deep", label: `${t("Settings.Repertoire.Deep")} (20)` },
          { value: "custom", label: t("Settings.Repertoire.Custom") },
        ]}
        value={preset}
        onChange={(val) => {
          if (val === "essential") setMinGames(200);
          else if (val === "standard") setMinGames(50);
          else if (val === "deep") setMinGames(20);
          setPreset(val as "standard" | "essential" | "deep" | "custom");
        }}
      />
      {preset === "custom" && (
        <NumberInput
          w={100}
          value={minGames}
          onChange={(val) => setMinGames(Number(val) || 50)}
          min={1}
          allowNegative={false}
          allowDecimal={false}
        />
      )}
    </Group>
  );
}
