import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const tooltip = style({
  margin: 0,
  padding: 5,
  opacity: 0.8,
  border: "1px solid #ccc",
  whiteSpace: "nowrap",
  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
    color: vars.colors.black,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[3],
    color: vars.colors.white,
  },
});

export const tooltipTitle = style({
  fontWeight: "bold",
});
