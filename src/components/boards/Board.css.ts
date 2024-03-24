import { style } from "@vanilla-extract/css";

export const container = style({
  display: "grid",
  gridTemplateColumns: "min-content 1fr",
  gridTemplateRows: "0.1fr 2.5fr 0.1fr",
  gap: "0.2rem 1rem",
  gridAutoFlow: "row",
  gridTemplateAreas: `
      ". Top Top"
      "Eval Board Board"
      ". Bottom Bottom"
    `,
  overflow: "hidden",
  height: "100%",
});

export const board = style({
  gridArea: "Board",
  overflow: "hidden",
});

export const top = style({
  gridArea: "Top",
});

export const bottom = style({
  gridArea: "Bottom",
});

export const evalStyle = style({
  gridArea: "Eval",
});
