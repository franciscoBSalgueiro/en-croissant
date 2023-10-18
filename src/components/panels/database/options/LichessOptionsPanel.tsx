import { Stack } from "@mantine/core";
import ToggleButtonGroup from "@/components/common/ToggleButtonGroup";
import { LichessGameSpeed, LichessGamesOptions, LichessRating } from "@/utils/lichess/lichessexplorer";
import { match } from "ts-pattern";
import { IconChevronRight, IconChevronsRight, IconClockHour4, IconFlame, IconHourglassHigh, IconSend } from "@tabler/icons-react";
import { MonthPickerInput } from "@mantine/dates";

interface LichessOptionsPanelProps {
    options: LichessGamesOptions;
    setOptions(options: LichessGamesOptions): void;
}

const LichessOptionsPanel = (props: LichessOptionsPanelProps) => {
    const timeControls: LichessGameSpeed[] = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];
    const ratings: LichessRating[] = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500];

    function mapTimeControl(speed: LichessGameSpeed) {
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
            isToggled: (props.options.speeds ?? []).some(s => s === speed)
        };
    }

    function mapRatingOption(rating: LichessRating) {
        const name = rating == 0 ? "400" : rating.toString();
        return {
            content: (<span>{name}</span>),
            name: name,
            value: rating,
            isToggled: (props.options.ratings ?? []).some(r => r === rating)
        };
    }

    function toggleTimeControl(speed: LichessGameSpeed) {
        const selected = props.options.speeds ?? [];
        const newSelected = [...selected];
        const index = newSelected.indexOf(speed);
        if (index >= 0) {
            newSelected.splice(index, 1);
        } else {
            newSelected.push(speed);
        }
        props.setOptions({...props.options, speeds: newSelected});
    }

    function toggleRating(rating: LichessRating) {
        const selected = props.options.ratings ?? [];
        const newSelected = [...selected];
        const index = newSelected.indexOf(rating);
        if (index >= 0) {
            newSelected.splice(index, 1);
        } else {
            newSelected.push(rating);
        }
        props.setOptions({...props.options, ratings: newSelected});
    }

    return (
        <Stack justify="flex-start">
            <ToggleButtonGroup label="Time control"
                options={timeControls.map(mapTimeControl)}
                toggleOption={toggleTimeControl}
                minButtonWidth="9ch"
                includeTooltips />
            <ToggleButtonGroup label="Average rating"
                options={ratings.map(mapRatingOption)}
                toggleOption={toggleRating}
                minButtonWidth="9ch" />
            <MonthPickerInput label="Since"
                placeholder="Pick date"
                value={props.options.since ?? null}
                onChange={value => props.setOptions({...props.options, since: value ?? undefined})}
                clearable />
            <MonthPickerInput label="Until"
                placeholder="Pick date"
                value={props.options.until ?? null}
                onChange={value => props.setOptions({...props.options, until: value ?? undefined})}
                clearable />
        </Stack>
    );
}

export default LichessOptionsPanel;