import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const newTab = style({
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.colors.dark[4]}`,
  padding: "0.4rem",
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
