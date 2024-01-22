import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const selected = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[0],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[5],
  },
});
