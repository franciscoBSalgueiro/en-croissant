import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const tab = style({
  cursor: "unset",
  marginRight: 5,
  [vars.lightSelector]: {
    backgroundColor: "transparent",
    color: vars.colors.gray[9],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
    color: vars.colors.gray[4],
  },
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: vars.colors.gray[2],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[6],
    },
  },
});

export const selected = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[0],
    color: vars.colors.gray[9],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[6],
    color: vars.colors.gray[0],
  },
});

export const input = style({
  minWidth: "5rem",
  fontSize: "0.8rem",
  paddingTop: "0.4rem",
  paddingBottom: "0.4rem",
  outline: "none",
  textAlign: "start",
});
