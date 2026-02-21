import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const tab = style({
  paddingRight: 9,
  height: "2.2rem",
  [vars.lightSelector]: {
    backgroundColor: "transparent",
    color: vars.colors.gray[7],
  },
  [vars.darkSelector]: {
    backgroundColor: "transparent",
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
  ":active": {
    transform: "unset",
  },
});

export const selected = style({
  borderTop: "2px solid var(--mantine-primary-color-filled)",
  borderBottom: "2px solid transparent",
  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
  },
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: vars.colors.white,
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[7],
    },
  },
});

export const input = style({
  all: "unset",
  minWidth: "5rem",
  fontSize: "0.8rem",
  paddingTop: "0.4rem",
  paddingBottom: "0.4rem",
  outline: "none",
  textAlign: "start",
});

export const closeTabBtn = style({
  boxSizing: "content-box",
  padding: "0.3rem",
  transition: "background-color 100ms ease",
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: "rgba(0, 0, 0, 0.05)",
    },
    [vars.darkSelector]: {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
  },
});
