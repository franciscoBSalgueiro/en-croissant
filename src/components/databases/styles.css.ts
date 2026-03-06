import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const selected = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[0],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[5],
  },
});
