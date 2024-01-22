import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const row = style({
  padding: "0 10px",
  cursor: "pointer",
  borderBottom: `1px solid ${vars.colors.gray[7]}`,
  [vars.lightSelector]: {
    "&:hover": {
      backgroundColor: vars.colors.gray[0],
    },
  },
  [vars.darkSelector]: {
    "&:hover": {
      backgroundColor: vars.colors.dark[6],
    },
  },
});

export const active = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[2],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[4],
  },
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: vars.colors.gray[2],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[4],
    },
  },
});
