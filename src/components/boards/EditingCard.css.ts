import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const card = style({
  height: "100%",
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  flexDirection: "column",

  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
  },
});
