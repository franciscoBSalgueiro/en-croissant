import { MasterGamesOptions } from "@/utils/lichess/lichessexplorer";
import { Stack } from "@mantine/core";
import { YearPickerInput } from "@mantine/dates";

interface MasterOptionsPanelProps {
    options: MasterGamesOptions;
    setOptions(options: MasterGamesOptions): void;
}

const MasterOptionsPanel = (props: MasterOptionsPanelProps) => {

    return (
        <Stack justify="flex-start">
            <YearPickerInput label="Since"
                placeholder="Pick date"
                value={props.options.since ?? null}
                onChange={value => props.setOptions({...props.options, since: value ?? undefined})}
                clearable />
            <YearPickerInput label="Until"
                placeholder="Pick date"
                value={props.options.until ?? null}
                onChange={value => props.setOptions({...props.options, until: value ?? undefined})}
                clearable />
        </Stack>
    );
}

export default MasterOptionsPanel;