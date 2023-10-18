import { MasterGamesOptions } from "@/utils/lichess/lichessexplorer";
import { Stack } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";

interface MasterOptionsPanelProps {
    options: MasterGamesOptions;
    setOptions(options: MasterGamesOptions): void;
}

const MasterOptionsPanel = (props: MasterOptionsPanelProps) => {

    const setSince = (date: Date | null | undefined) => props.setOptions({...props.options, since: date ?? undefined});
    const setUntil = (date: Date | null | undefined) => props.setOptions({...props.options, until: date ?? undefined});

    return (
        <Stack justify="flex-start">
            <MonthPickerInput label="Since"
                placeholder="Pick date"
                value={props.options.since}
                onChange={setSince}
                clearable />
            <MonthPickerInput label="Until"
                placeholder="Pick date"
                value={props.options.until}
                onChange={setUntil}
                clearable />
        </Stack>
    );
}

export default MasterOptionsPanel;