import {
    Switch,
    createStyles,
} from "@mantine/core";
import { PrimitiveAtom, useAtom } from "jotai";

const useStyles = createStyles(() => ({
    switch: {
        "& *": {
            cursor: "pointer",
        },
    },
}));

export default function SettingsSwitch({
    atom,
}: {
    atom: PrimitiveAtom<boolean>;
}) {
    const { classes } = useStyles();
    const [checked, setChecked] = useAtom(atom);
    return <Switch
        onLabel="ON"
        offLabel="OFF"
        size="lg"
        checked={checked}
        onChange={(event) => setChecked(event.currentTarget.checked)}
        className={classes.switch}
    />
}
