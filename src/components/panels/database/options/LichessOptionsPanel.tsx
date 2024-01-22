import { Group, Stack } from "@mantine/core";
import ToggleButtonGroup, {
  ToggleButtonGroupOption,
} from "@/components/common/ToggleButtonGroup";
import {
  LichessGameSpeed,
  LichessRating,
} from "@/utils/lichess/lichessexplorer";
import { match } from "ts-pattern";
import {
  IconChevronRight,
  IconChevronsRight,
  IconClockHour4,
  IconFlame,
  IconHourglassHigh,
  IconSend,
} from "@tabler/icons-react";
import { MonthPickerInput } from "@mantine/dates";
import { currentLichessOptionsAtom } from "@/atoms/atoms";
import { useAtom } from "jotai";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

const LichessOptionsPanel = () => {
  const [originalOptions, setOriginalOptions] = useAtom(
    currentLichessOptionsAtom,
  );
  const [options, setOptions] = useState(originalOptions);
  const [debouncedOptions] = useDebouncedValue(options, 500);

  useEffect(() => {
    setOptions(originalOptions);
  }, [originalOptions]);

  useEffect(() => {
    setOriginalOptions(debouncedOptions);
  }, [debouncedOptions, setOriginalOptions]);

  const timeControls: LichessGameSpeed[] = [
    "ultraBullet",
    "bullet",
    "blitz",
    "rapid",
    "classical",
    "correspondence",
  ];
  const ratings: LichessRating[] = [
    0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500,
  ];

  function mapTimeControl(
    speed: LichessGameSpeed,
  ): ToggleButtonGroupOption<LichessGameSpeed> {
    const name = `${speed.charAt(0).toUpperCase()}${speed.slice(1)}`;
    const icon = match(speed)
      .with("ultraBullet", () => <IconChevronsRight />)
      .with("bullet", () => <IconChevronRight />)
      .with("blitz", () => <IconFlame />)
      .with("rapid", () => <IconHourglassHigh />)
      .with("classical", () => <IconClockHour4 />)
      .with("correspondence", () => <IconSend />)
      .exhaustive();
    return {
      content: icon,
      name: name,
      value: speed,
      isToggled: (options.speeds ?? []).some((s) => s === speed),
    };
  }

  function mapRatingOption(
    rating: LichessRating,
  ): ToggleButtonGroupOption<LichessRating> {
    const name = rating == 0 ? "400" : rating.toString();
    return {
      content: <span>{name}</span>,
      name: name,
      value: rating,
      isToggled: (options.ratings ?? []).some((r) => r === rating),
    };
  }

  function toggleTimeControl(speed: LichessGameSpeed) {
    const selected = options.speeds ?? [];
    const newSelected = [...selected];
    const index = newSelected.indexOf(speed);
    if (index >= 0) {
      if (newSelected.length > 1) {
        newSelected.splice(index, 1);
      }
    } else {
      newSelected.push(speed);
    }
    setOptions({ ...options, speeds: newSelected });
  }

  function toggleRating(rating: LichessRating) {
    const selected = options.ratings ?? [];
    const newSelected = [...selected];
    const index = newSelected.indexOf(rating);
    if (index >= 0) {
      if (newSelected.length > 1) {
        newSelected.splice(index, 1);
      }
    } else {
      newSelected.push(rating);
    }
    setOptions({ ...options, ratings: newSelected });
  }

  return (
    <Stack justify="flex-start">
      <ToggleButtonGroup
        label="Time control"
        options={timeControls.map(mapTimeControl)}
        toggleOption={toggleTimeControl}
        minButtonWidth="9ch"
        includeTooltips
      />
      <ToggleButtonGroup
        label="Average rating"
        options={ratings.map(mapRatingOption)}
        toggleOption={toggleRating}
        minButtonWidth="9ch"
      />
      <Group grow>
        <MonthPickerInput
          label="Since"
          placeholder="Pick date"
          value={options.since ?? null}
          onChange={(value) =>
            setOptions({ ...options, since: value ?? undefined })
          }
          clearable
        />
        <MonthPickerInput
          label="Until"
          placeholder="Pick date"
          value={options.until ?? null}
          onChange={(value) =>
            setOptions({ ...options, until: value ?? undefined })
          }
          clearable
        />
      </Group>
    </Stack>
  );
};

export default LichessOptionsPanel;
