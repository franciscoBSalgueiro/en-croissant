import { createStyles, rem } from "@mantine/core";

export const useStyles = createStyles((theme) => ({
    mark: {
        display: "flex",
    },

    thumb: {
        width: rem(16),
        height: rem(28),
        backgroundColor: theme.white,
        color: theme.colors.gray[5],
        border:
            rem(1) + " solid " + theme.colorScheme === "dark"
                ? theme.colors.dark[2]
                : theme.colors.gray[3],
    },
}));
