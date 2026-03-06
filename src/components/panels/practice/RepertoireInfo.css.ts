import { style } from "@vanilla-extract/css";

export const moveRow = style({
  selectors: {
    "&:hover": {
      backgroundColor: "var(--mantine-color-default-hover)",
    },
  },
});
