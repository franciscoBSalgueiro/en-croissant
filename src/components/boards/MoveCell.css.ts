import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const cell = style({
  all: "unset",
  fontSize: "0.9rem",
  fontWeight: 600,
  display: "inline-block",
  padding: 6,
  borderRadius: 4,
  whiteSpace: "nowrap",
  cursor: "pointer",
  [vars.lightSelector]: {
    color: "var(--light-color)",
    backgroundColor: "var(--light-bg)",
  },
  [vars.darkSelector]: {
    color: "var(--dark-color)",
    backgroundColor: "var(--dark-bg)",
  },
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: "var(--light-hover-color)",
    },
    [vars.darkSelector]: {
      backgroundColor: "var(--dark-hover-color)",
    },
  },
});
