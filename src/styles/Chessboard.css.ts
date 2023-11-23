import { style } from "@vanilla-extract/css";

export const chessboard = style({
    position: "relative",
    flex: 1,
    zIndex: 1,
    display: "flex",
    aspectRatio: "1 / 1",
    maxHeight: "100%",
});
