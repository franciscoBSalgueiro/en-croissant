import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const progress = style({
  top: "-1px",
  left: "-1px",
  right: "-1px",
  bottom: "-1px",
  height: "auto",
  backgroundColor: "transparent",
  color: vars.colors.primaryColors[7],
  zIndex: 0,
});

export const label = style({
  position: "relative",
  zIndex: 1,
});
