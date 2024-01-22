import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const icon = style({
  transition: "background-color 100ms ease",
  ":hover": {
    backgroundColor: vars.colors.dark[5],
  },
});

export const close = style({
  transition: "background-color 100ms ease",
  ":hover": {
    backgroundColor: vars.colors.red[7],
    color: vars.colors.white,
  },
});
