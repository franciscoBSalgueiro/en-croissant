import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const result = style({
    [vars.lightSelector]: {
        outline: `1px solid ${vars.colors.gray[3]}`,
    },
    [vars.darkSelector]: {
        outline: `1px solid ${vars.colors.gray[8]}`,
    },
});

export const whiteResultsSection = style({
    [vars.lightSelector]: {
        backgroundColor: vars.colors.gray[1],
    },
    [vars.darkSelector]: {
        backgroundColor: vars.colors.white,
    },
});
