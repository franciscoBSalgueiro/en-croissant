import { rem } from "@mantine/core";
import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const tree = style({
    width: "100%",
    userSelect: "none",
});

export const row = style({
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
    paddingTop: rem(5),
    paddingBottom: rem(5),
    minHeight: rem(32),
    color: vars.colors.dark[0],
    [vars.lightSelector]: {
        color: vars.colors.gray[7],
        "&:hover": {
            backgroundColor: vars.colors.gray[2],
        },
    },
    [vars.darkSelector]: {
        "&:hover": {
            backgroundColor: vars.colors.dark[4],
        },
    },
});

export const guides = style({
    position: "absolute",
    top: 0,
    bottom: 0,
    opacity: 0.28,
    pointerEvents: "none",
    backgroundPosition: "left top",
    backgroundRepeat: "repeat-x",
    backgroundSize: `${rem(16)} 100%`,
    [vars.lightSelector]: {
        backgroundImage: `linear-gradient(to right, ${vars.colors.gray[3]} 1px, transparent 1px)`,
    },
    [vars.darkSelector]: {
        backgroundImage: `linear-gradient(to right, ${vars.colors.dark[2]} 1px, transparent 1px)`,
    },
});

export const selected = style({
    [vars.lightSelector]: {
        backgroundColor: vars.colors.gray[3],
        color: vars.colors.dark[0],
        boxShadow: `inset 2px 0 0 ${vars.colors.primaryColors[5]}`,
        "&:hover": {
            backgroundColor: vars.colors.gray[4],
        },
    },
    [vars.darkSelector]: {
        backgroundColor: vars.colors.dark[5],
        color: vars.colors.gray[0],
        boxShadow: `inset 2px 0 0 ${vars.colors.primaryColors[7]}`,
        "&:hover": {
            backgroundColor: vars.colors.dark[4],
        },
    },
});

export const iconContainer = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: rem(20),
    height: rem(20),
    flexShrink: 0,
});

export const expandIcon = style({
    width: rem(16),
    height: rem(16),
});

export const expandIconRotated = style({
    transform: "rotate(90deg)",
});

export const typeIcon = style({
    width: rem(16),
    height: rem(16),
    marginRight: rem(6),
});

export const label = style({
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: rem(14),
});

export const badge = style({
    marginLeft: "auto",
    marginRight: rem(8),
});

export const dragOver = style({
    [vars.lightSelector]: {
        backgroundColor: vars.colors.primaryColors[1],
        boxShadow: `inset 0 0 0 1px ${vars.colors.primaryColors[4]}`,
    },
    [vars.darkSelector]: {
        backgroundColor: vars.colors.dark[4],
        boxShadow: `inset 0 0 0 1px ${vars.colors.primaryColors[8]}`,
    },
});
