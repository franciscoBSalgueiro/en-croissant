import { style } from "@vanilla-extract/css";

export const link = style({
  cursor: "pointer",
  ":hover": {
    textDecoration: "underline",
  },
});
