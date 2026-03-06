import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const logo = style({
  width: 30,
  height: 30,
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
