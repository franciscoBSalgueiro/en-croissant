import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const cell = style({
  all: "unset",
  fontSize: "0.9rem",
  fontWeight: 600,
  display: "inline-block",
  padding: 6,
  borderRadius: 4,
  whiteSpace: "nowrap",
  cursor: "pointer",
  boxSizing: "border-box",
  maxWidth: "100%",
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

export const cellFullWidth = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  minWidth: 0,
  textAlign: "left",
  borderRadius: 0,
});

export const moveText = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  flexGrow: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const rightAccessory = style({
  flexShrink: 0,
});
