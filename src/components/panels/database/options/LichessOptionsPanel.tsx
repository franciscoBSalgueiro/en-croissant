import ToggleButtonGroup, {
  type ToggleButtonGroupOption,
} from "@/components/common/ToggleButtonGroup";
import { lichessOptionsAtom } from "@/state/atoms";
import { capitalize } from "@/utils/format";
import { MIN_DATE } from "@/utils/lichess/api";
import type { LichessGameSpeed, LichessRating } from "@/utils/lichess/explorer";
import { Group, Select, Stack, TextInput } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import {
  IconChevronRight,
  IconChevronsRight,
  IconClockHour4,
  IconFlame,
  IconHourglassHigh,
  IconSend,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

const LichessOptionsPanel = () => {
  const { t } = useTranslation();

  const [options, setOptions] = useAtom(lichessOptionsAtom);

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
      name: t(`TimeControl.${capitalize(name)}`),
      value: speed,
      isToggled: (options.speeds ?? []).some((s) => s === speed),
    };
  }

  function mapRatingOption(
    rating: LichessRating,
  ): ToggleButtonGroupOption<LichessRating> {
    const name = rating === 0 ? "400" : rating.toString();
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
        label={t("Board.Database.TimeControl")}
        options={timeControls.map(mapTimeControl)}
        toggleOption={toggleTimeControl}
        minButtonWidth="9ch"
        includeTooltips
      />
      <ToggleButtonGroup
        label={t("Board.Database.AverageRating")}
        options={ratings.map(mapRatingOption)}
        toggleOption={toggleRating}
        minButtonWidth="9ch"
      />
      <Group grow>
        <MonthPickerInput
          label="Since"
          placeholder="Pick date"
          value={options.since}
          minDate={MIN_DATE}
          maxDate={new Date()}
          onChange={(value) =>
            setOptions({ ...options, since: value ?? undefined })
          }
          clearable
        />
        <MonthPickerInput
          label="Until"
          placeholder="Pick date"
          value={options.until}
          minDate={MIN_DATE}
          maxDate={new Date()}
          onChange={(value) =>
            setOptions({ ...options, until: value ?? undefined })
          }
          clearable
        />
      </Group>
      <Group grow>
        <TextInput
          label="Player"
          placeholder="Player's username"
          value={options.player ?? ""}
          onChange={(e) =>
            setOptions({ ...options, player: e.currentTarget.value })
          }
        />
        <Select
          label="Color"
          placeholder="Select color"
          data={[
            { label: "White", value: "white" },
            { label: "Black", value: "black" },
          ]}
          value={options.color}
          onChange={(v) =>
            setOptions({ ...options, color: v as "white" | "black" })
          }
          clearable={false}
        />
      </Group>
    </Stack>
  );
};

export default LichessOptionsPanel;
