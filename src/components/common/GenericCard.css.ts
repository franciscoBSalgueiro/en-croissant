import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const card = style({
  cursor: "pointer",
  borderStyle: "solid",
  padding: "1rem",
  borderRadius: vars.radius.md,
  borderWidth: 2,
  borderColor: "transparent",

  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[6],
  },
  ":hover": {
    [vars.lightSelector]: {
      backgroundColor: vars.colors.gray[0],
      borderColor: vars.colors.gray[6],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[6],
      borderColor: vars.colors.gray[6],
    },
  },
});

export const label = style({
  marginBottom: vars.spacing.xs,
  lineHeight: 1,
  fontWeight: 700,
  fontSize: vars.fontSizes.xs,
  letterSpacing: -0.25,
  textTransform: "uppercase",
});

export const info = style({
  display: "flex",
  justifyContent: "space-between",
});

export const error = style({
  borderColor: `${vars.colors.red[6]} !important`,
  borderWidth: 1,

  ":hover": {
    borderColor: vars.colors.red[6],
  },
});

export const selected = style({
  borderColor: "var(--mantine-primary-color-filled) !important",

  ":hover": {
    borderColor: "var(--mantine-primary-color-filled)",
  },
});
