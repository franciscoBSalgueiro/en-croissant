import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const tabsContainer = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
});

export const tabsHeader = style({
  marginBottom: "0.5rem",
  flexShrink: 0,
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[1],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
  },
});

export const newTab = style({
  height: "2.2rem",
  width: "2.2rem",
  padding: "0.5em",
  [vars.lightSelector]: {
    border: `1px solid ${vars.colors.gray[3]}`,
    backgroundColor: vars.colors.gray[1],
  },
  [vars.darkSelector]: {
    border: `1px solid ${vars.colors.dark[4]}`,
    backgroundColor: vars.colors.dark[7],
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

export const tabsFiller = style({
  flexGrow: 1,
  [vars.lightSelector]: {
    borderBottom: `1px solid ${vars.colors.gray[3]}`,
  },
  [vars.darkSelector]: {
    borderBottom: `1px solid ${vars.colors.dark[4]}`,
  },
});
