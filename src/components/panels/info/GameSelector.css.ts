import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const row = style({
  padding: "0.25rem 0.625rem",
  cursor: "pointer",
  borderLeft: "3px solid transparent",
  [vars.lightSelector]: {
    "&:hover": {
      backgroundColor: vars.colors.gray[1],
    },
  },
  [vars.darkSelector]: {
    "&:hover": {
      backgroundColor: vars.colors.dark[5],
    },
  },
});

export const active = style({
  fontWeight: 600,
  borderLeft: `3px solid ${vars.colors.primary}`,
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[1],
    "&:hover": {
      backgroundColor: vars.colors.gray[2],
    },
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[5],
    "&:hover": {
      backgroundColor: vars.colors.dark[4],
    },
  },
});

export const index = style({
  fontVariantNumeric: "tabular-nums",
  opacity: 0.5,
  fontSize: "0.75em",
  minWidth: "0.75rem",
  textAlign: "right",
  flexShrink: 0,
  userSelect: "none",
});

export const deleteBtn = style({
  opacity: 0,
  selectors: {
    [`${row}:hover &`]: {
      opacity: 1,
    },
    [`${active} &`]: {
      opacity: 1,
    },
  },
});
