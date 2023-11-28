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
            rem(1) +
            " solid " +
            "light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-2))",
    },
}));
