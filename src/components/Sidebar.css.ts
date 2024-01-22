import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const link = style({
  width: "3rem",
  height: "3rem",
  display: "flex",
  alignItems: "center",
  borderLeft: "3px solid transparent",
  borderRight: "3px solid transparent",
  justifyContent: "center",
  [vars.lightSelector]: {
    color: vars.colors.gray[7],
  },
  [vars.darkSelector]: {
    color: vars.colors.dark[0],
  },

  ":hover": {
    [vars.lightSelector]: {
      color: vars.colors.dark[5],
    },
    [vars.darkSelector]: {
      color: vars.colors.gray[0],
    },
  },
});

export const active = style({
  borderLeftColor: vars.colors.primary,
  [vars.lightSelector]: {
    color: vars.colors.dark[5],
  },
  [vars.darkSelector]: {
    color: vars.colors.white,
  },
});
