import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const finished = style({
    backgroundColor: vars.colors.green[7],
    color: vars.colors.gray[2],
});

export const progress = style({
    position: "absolute",
    height: "auto",
    backgroundColor: "transparent",
    zIndex: 0,
});

export const label = style({
    position: "relative",
    zIndex: 1,
});
