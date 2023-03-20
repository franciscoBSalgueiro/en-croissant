import { createStyles } from "@mantine/core";

const useStyles = createStyles((theme) => ({
    diff: {
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
    },

    rating: {
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
        fontWeight: 700,
        fontSize: 18,
        lineHeight: 1,
        border: `1px solid ${
            theme.colorScheme === "dark"
                ? theme.colors.dark[5]
                : theme.colors.gray[3]
        }`,
        borderRadius: theme.radius.sm,
        padding: theme.spacing.md,

        ":hover": {
            backgroundColor:
                theme.colorScheme === "dark"
                    ? theme.colors.dark[6]
                    : theme.colors.gray[0],
        },
        transition: "all 100ms ease-in-out",
    },

    card: {
        backgroundColor:
            theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    },

    label: {
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
        fontWeight: 700,
        lineHeight: 1,
    },

    lead: {
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
        fontWeight: 700,
        fontSize: 22,
        lineHeight: 1,
    },
}));

export default useStyles;
