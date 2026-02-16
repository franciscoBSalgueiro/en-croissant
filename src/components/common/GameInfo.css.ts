import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const colorHover = style({
  ":hover": {
    textDecoration: "underline",
    cursor: "pointer",
  },
});

export const contentEditable = style({
  outline: "none",
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
    userSelect: "none",
  },
});

export const contentEditablePlaceholder = style({
  ":before": {
    content: "attr(data-placeholder)",
    fontStyle: "italic",
    cursor: "text",
  },
  color: vars.colors.gray[6],
});

export const textInput = style({
  all: "unset",
  outline: "none",
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
    userSelect: "none",
  },
});

export const nameInput = style({
  padding: 0,
  fontWeight: 500,
  lineHeight: 0,
  height: "auto",
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
    [vars.lightSelector]: {
      color: vars.colors.gray[0],
    },
    [vars.darkSelector]: {
      color: vars.colors.black,
    },
  },
});

export const eloInput = style({
  all: "unset",
  height: "auto",
  opacity: "75%",
  padding: 0,
  lineHeight: 0,
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
    [vars.lightSelector]: {
      color: vars.colors.gray[0],
    },
    [vars.darkSelector]: {
      color: vars.colors.black,
    },
  },
});

export const right = style({
  textAlign: "right",
});

export const dateInput = style({
  textAlign: "center",
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
  },
});

export const roundInput = style({
  all: "unset",
  fontSize: vars.fontSizes.md,
  width: "3rem",
  ":disabled": {
    cursor: "default",
    backgroundColor: "transparent",
  },
});
