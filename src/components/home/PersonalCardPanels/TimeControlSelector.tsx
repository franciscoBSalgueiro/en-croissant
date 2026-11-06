import { Select } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LICHESS_TIME_CONTROLS = [
  { value: "ultra_bullet", label: "UltraBullet" },
  { value: "bullet", label: "Bullet" },
  { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" },
  { value: "classical", label: "Classical" },
  { value: "correspondence", label: "Correspondence" },
];

const CHESSCOM_TIME_CONTROLS = [
  { value: "bullet", label: "Bullet" },
  { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" },
  { value: "daily", label: "Daily" },
];

interface TimeControlSelectorProps {
  onTimeControlChange: (value: string | null) => void;
  website: string | null;
  allowAll: boolean;
  showLabel?: boolean;
}

const TimeControlSelector = ({
  onTimeControlChange,
  website,
  allowAll,
  showLabel = true,
}: TimeControlSelectorProps) => {
  const { t } = useTranslation();
  const timeControls =
    website === "Chess.com"
      ? [...(allowAll ? [{ value: "any", label: "Any" }] : []), ...CHESSCOM_TIME_CONTROLS]
      : [...(allowAll ? [{ value: "any", label: "Any" }] : []), ...LICHESS_TIME_CONTROLS];

  const defaultTimeControl = allowAll ? "any" : "rapid";
  const [timeControl, setTimeControl] = useState<string | null>(defaultTimeControl);

  useEffect(() => {
    onTimeControlChange(timeControl);
  }, [timeControl]);

  useEffect(() => {
    if (!timeControls.some((control) => control.value === timeControl)) {
      setTimeControl(defaultTimeControl);
    }
  }, [website, timeControls]);

  return (
    <Select
      pt={showLabel ? "lg" : undefined}
      label={showLabel ? t("Board.Database.TimeControl") : undefined}
      aria-label={t("Board.Database.TimeControl")}
      value={timeControl}
      onChange={(value) => setTimeControl(value)}
      data={timeControls.map((control) => ({
        ...control,
        label:
          control.value === "any"
            ? t("Board.Database.Local.Result.Any")
            : control.value === "daily"
              ? t("Home.Personal.Daily")
              : t(`TimeControl.${control.label}`),
      }))}
      allowDeselect={false}
    />
  );
};

export default TimeControlSelector;
