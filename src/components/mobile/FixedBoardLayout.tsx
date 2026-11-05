import type { LayoutMode } from "@/utils/mobile";
import classes from "./FixedBoardLayout.module.css";

// Board.tsx: board width = container height - 2 player bars - gaps + eval bar.
// This is the extra height (beyond the board width) the board column needs.
const BOARD_CHROME = 40;

/**
 * Touch layouts with fixed areas instead of the resizable desktop windows.
 * The portal targets (#left, #mobileStrip, #topRight, #bottomRight) are the same
 * the board views render into; empty slots collapse.
 */
export default function FixedBoardLayout({
  mode,
  width,
  height,
}: {
  mode: Exclude<LayoutMode, "desktop">;
  width: number;
  height: number;
}) {
  if (mode === "landscape") {
    // Square board as tall as possible, but leave at least ~38% for the side panel.
    // On wide screens (iPad) give the panels more room.
    const maxShare = width > 900 ? 0.56 : 0.62;
    const boardWidth = Math.round(Math.max(0, Math.min(height - BOARD_CHROME, width * maxShare)));
    return (
      <div className={classes.landscape}>
        <div id="left" style={{ width: boardWidth, height: "100%", flexShrink: 0 }} />
        <div className={classes.side}>
          <div id="mobileStrip" className={classes.slot} style={{ flexShrink: 0 }} />
          <div id="topRight" className={classes.fill} />
          <div id="bottomRight" className={`${classes.slot} ${classes.fill}`} />
        </div>
      </div>
    );
  }

  // Portrait: board as wide as the screen, capped so the panels keep some room.
  const maxBoard = height > 0 ? height * 0.62 : width + BOARD_CHROME;
  const boardHeight = Math.round(Math.min(width + BOARD_CHROME, maxBoard));
  return (
    <div className={classes.portrait}>
      <div id="left" style={{ height: boardHeight, flexShrink: 0 }} />
      <div id="mobileStrip" className={classes.slot} style={{ flexShrink: 0 }} />
      <div id="topRight" className={classes.fill} />
      <div id="bottomRight" className={`${classes.slot} ${classes.fill}`} />
    </div>
  );
}
