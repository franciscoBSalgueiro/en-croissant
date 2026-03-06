import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const info = style({
  ":hover": {
    cursor: "pointer",
    [vars.lightSelector]: {
      backgroundColor: vars.colors.gray[2],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[6],
    },
  },
  transition: "background-color 0.1s ease-in-out",
});
