import { Select } from "@mantine/core";
import { useEffect, useState } from "react";

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
}

const TimeControlSelector = ({
  onTimeControlChange,
  website,
  allowAll,
}: TimeControlSelectorProps) => {
  const timeControls =
    website === "Chess.com"
      ? [
          ...(allowAll ? [{ value: "any", label: "Any" }] : []),
          ...CHESSCOM_TIME_CONTROLS,
        ]
      : [
          ...(allowAll ? [{ value: "any", label: "Any" }] : []),
          ...LICHESS_TIME_CONTROLS,
        ];

  const defaultTimeControl = allowAll ? "any" : "rapid";
  const [timeControl, setTimeControl] = useState<string | null>(
    defaultTimeControl,
  );

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
      pt="lg"
      label="Time control"
      value={timeControl}
      onChange={(value) => setTimeControl(value)}
      data={timeControls}
      allowDeselect={false}
    />
  );
};

export default TimeControlSelector;
