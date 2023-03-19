import { createStyles } from "@mantine/core";

const useStyles = createStyles((theme) => ({
    selected: {
        backgroundColor: `${
            theme.colorScheme === "dark"
                ? theme.fn.rgba(theme.colors[theme.primaryColor][7], 0.3)
                : theme.colors[theme.primaryColor][0]
        } !important`,
    },
    search: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor:
            theme.colorScheme === "dark"
                ? theme.colors.dark[7]
                : theme.colors.gray[0],
        botderWidth: 1,
        borderColor:
            theme.colorScheme === "dark"
                ? theme.colors.dark[6]
                : theme.colors.gray[2],
        borderStyle: "solid",
    },
}));

export default useStyles;
