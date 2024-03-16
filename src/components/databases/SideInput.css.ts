import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const control = style({
  display: "flex",
  alignItems: "center",
  padding: "8px 15px 8px 15px",
  borderRadius: vars.radius.md,
  transition: "background-color 150ms ease",

  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
    border: `2px solid ${vars.colors.gray[2]}`,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[5],
    border: `2px solid ${vars.colors.dark[4]}`,
  },

  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: vars.colors.gray[0],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[5],
    },
  },
});
