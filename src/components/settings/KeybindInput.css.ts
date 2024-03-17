import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const kbd = style({
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[6],
  },
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[2],
  },
});
