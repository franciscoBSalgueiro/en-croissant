import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const button = style({
    position: "relative",
    transition: "background-color 150ms ease",
    backgroundColor: vars.colors.gray[7],
    color: vars.colors.gray[5],
});

export const finished = style({
    backgroundColor: vars.colors.green[7],
    color: vars.colors.gray[2],
});

export const progress = style({
    position: "absolute",
    bottom: -1,
    right: -1,
    left: -1,
    top: -1,
    height: "auto",
    backgroundColor: "transparent",
    zIndex: 0,
});

export const label = style({
    position: "relative",
    zIndex: 1,
});
