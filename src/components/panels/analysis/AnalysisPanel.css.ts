import { style } from "@vanilla-extract/css";

export const label = style({
  cursor: "pointer",
  ":hover": {
    textDecoration: "underline",
  },
});
