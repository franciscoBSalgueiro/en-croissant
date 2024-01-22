import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const card = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.white,
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[7],
  },
});

export const item = style({
  [vars.lightSelector]: {
    borderTop: `1px solid ${vars.colors.gray[2]}`,
  },
  [vars.darkSelector]: {
    borderTop: `1px solid ${vars.colors.dark[4]}`,
  },
  paddingTop: vars.spacing.sm,
  marginTop: vars.spacing.sm,
});

export const title = style({
  lineHeight: 1,
});
