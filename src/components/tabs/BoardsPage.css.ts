import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const tabsContainer = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
});

export const tabsHeader = style({
  borderBottom: `1px solid ${vars.colors.dark[4]}`,
  marginBottom: "0.5rem",
  backgroundColor: `${vars.colors.dark[7]}`,
  flexShrink: 0,
});

export const newTab = style({
  height: "2.2rem",
  width: "2.2rem",
  border: `1px solid ${vars.colors.dark[4]}`,
  padding: "0.5em",
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[0],
  },
  [vars.darkSelector]: {
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
