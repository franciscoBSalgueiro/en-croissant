import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme";

export const chessboard = style({
  position: "relative",
  flex: 1,
  zIndex: 1,
  display: "flex",
  aspectRatio: "1",
});

globalStyle(
  `${chessboard} > .cg-wrap > cg-container > cg-board > square.last-move`,
  {
    [vars.darkSelector]: {
      backgroundColor:
        "color-mix(in srgb, var(--light-color, var(--mantine-primary-color-5)) 40%, transparent)",
    },
    [vars.lightSelector]: {
      backgroundColor:
        "color-mix(in srgb, var(--dark-color, var(--mantine-primary-color-3)) 40%, transparent)",
    },
  },
);
