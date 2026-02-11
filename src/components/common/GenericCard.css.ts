import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const card = style({
  cursor: "pointer",
  borderStyle: "solid",
  padding: "1rem",
  borderRadius: vars.radius.md,
  borderWidth: 2,
  borderColor: "transparent",
  boxShadow: vars.shadows.xs,

  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
    borderColor: vars.colors.gray[2],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[6],
    borderColor: vars.colors.dark[4],
  },
  ":hover": {
    boxShadow: vars.shadows.md,
    [vars.lightSelector]: {
      backgroundColor: vars.colors.white,
      borderColor: vars.colors.gray[4],
    },
    [vars.darkSelector]: {
      backgroundColor: vars.colors.dark[5],
      borderColor: vars.colors.dark[3],
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
  boxShadow: `${vars.shadows.md} !important`,

  ":hover": {
    borderColor: "var(--mantine-primary-color-filled)",
  },
});
