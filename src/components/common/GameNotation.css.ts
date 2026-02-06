import { vars } from "@/styles/theme";
import { style } from "@vanilla-extract/css";

export const variationBorder = style({
  borderLeft: "2px solid #404040",
  paddingLeft: 5,
  marginLeft: 12,
});

export const lineBeforeVariation = style({
  "::before": {
    display: "inline-block",
    content: '" "',
    borderTop: "2px solid #404040",
    width: 8,
    height: 5,
    marginLeft: -5,
    marginTop: 16,
  },
});

export const moveTableMoveNumber = style({
  width: 36,
  textAlign: "center",
  fontSize: "0.8rem",
  fontWeight: 600,
  opacity: 0.6,
  verticalAlign: "middle",
  [vars.darkSelector]: {
    color: "#aaa",
  },
  [vars.lightSelector]: {
    color: "#666",
  },
});

export const moveTableCell = style({
  padding: 0,
  verticalAlign: "middle",
  overflow: "hidden",
  minWidth: 0,
});
