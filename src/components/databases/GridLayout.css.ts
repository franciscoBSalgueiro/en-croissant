import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const search = style({
  padding: vars.spacing.md,
  borderRadius: vars.radius.md,
  borderWidth: 1,
  borderStyle: "solid",

  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
    borderColor: vars.colors.gray[2],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
    borderColor: vars.colors.dark[6],
  },
});
