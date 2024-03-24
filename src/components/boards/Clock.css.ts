import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const whiteClock = style({
  color: vars.colors.black,
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[2],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.gray[2],
  },
});

export const blackClock = style({
  color: vars.colors.white,
  [vars.lightSelector]: {
    backgroundColor: vars.colors.dark[6],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[6],
  },
});
