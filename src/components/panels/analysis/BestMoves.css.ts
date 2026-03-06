import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const subtitle = style({
  [vars.lightSelector]: {
    color: vars.colors.black,
  },
  [vars.darkSelector]: {
    color: vars.colors.gray[5],
  },
});
