import { rem } from "@mantine/core";
import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme";

export const icon = style({
  width: rem(13),
  height: "auto",
  verticalAlign: rem(-1),
  marginRight: rem(8),
});

export const expandIcon = style({
  transition: "transform 0.2s",
});

export const expandIconRotated = style({
  transform: "rotate(90deg)",
});

export const table = style({
  padding: 0,
});

export const selected = style({
  [vars.lightSelector]: {
    backgroundColor: vars.colors.gray[0],
  },
  [vars.darkSelector]: {
    backgroundColor: vars.colors.dark[5],
  },
});
