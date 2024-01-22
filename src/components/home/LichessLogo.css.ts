import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const logo = style({
  width: 35,
  height: 35,
  borderRadius: vars.radius.sm,
  overflow: "hidden",
  [vars.lightSelector]: {
    fill: vars.colors.black,
    stroke: vars.colors.black,
  },
  [vars.darkSelector]: {
    fill: vars.colors.white,
    stroke: vars.colors.white,
  },
});
