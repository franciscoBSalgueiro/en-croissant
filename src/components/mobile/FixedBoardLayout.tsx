import { useElementSize } from "@mantine/hooks";
import { useEffect, useState } from "react";
import type { LayoutMode } from "@/utils/mobile";
import classes from "./FixedBoardLayout.module.css";

// Board.tsx: board width = container height - 2 player bars - gaps + eval bar.
// This is the extra height (beyond the board width) the board column needs.
const BOARD_CHROME = 40;

/**
 * Element size that ignores tiny changes, so sub-pixel jitter (e.g. while iOS
 * animates a rotation or the safe areas settle) can't make the board pulse.
 */
function useStableSize() {
  const { ref, width, height } = useElementSize();
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const w = Math.floor(width);
    const h = Math.floor(height);
    setSize((prev) =>
      Math.abs(prev.width - w) < 3 && Math.abs(prev.height - h) < 3 ? prev : { width: w, height: h },
    );
  }, [width, height]);
  return { ref, ...size };
}

/**
 * Touch layouts with fixed areas instead of the resizable desktop windows.
 * The portal targets (#left, #mobileStrip, #topRight, #bottomRight) are the same
 * the board views render into; empty slots collapse.
 *
 * The DOM structure is identical in portrait and landscape (only CSS differs), so
 * rotating the device never recreates the portal targets – otherwise the panels
 * rendered into them would vanish.
 */
export default function FixedBoardLayout({ mode }: { mode: Exclude<LayoutMode, "desktop"> }) {
  // Measured on an element whose size only depends on its parent (children are
  // absolutely positioned), so the board size can't feed back into the measurement.
  const { ref, width, height } = useStableSize();
  const landscape = mode === "landscape";

  let boardStyle: React.CSSProperties;
  if (landscape) {
    // Square board as tall as possible, but leave room for the side panel.
    // On wide screens (iPad) give the panels more room.
    const maxShare = width > 900 ? 0.56 : 0.62;
    const boardWidth = Math.round(Math.max(0, Math.min(height - BOARD_CHROME, width * maxShare)));
    boardStyle = { width: boardWidth, height: "100%" };
  } else {
    // Portrait: board as wide as the screen, capped so the panels keep some room.
    const maxBoard = height > 0 ? height * 0.62 : width + BOARD_CHROME;
    const boardHeight = Math.round(Math.min(width + BOARD_CHROME, maxBoard));
    boardStyle = { width: "100%", height: boardHeight };
  }
  const ready = width > 0 && height > 0;

  return (
    <div ref={ref} className={classes.root}>
      <div
        className={`${classes.inner} ${landscape ? classes.landscape : classes.portrait}`}
        style={{ visibility: ready ? "visible" : "hidden" }}
      >
        <div id="left" className={classes.board} style={boardStyle} />
        {/* The panels scroll (swipe up) when they don't fit. */}
        <div className={classes.side} data-mobile-scroll>
          <div id="mobileStrip" className={classes.slot} style={{ flexShrink: 0 }} />
          <div id="topRight" className={`${classes.panel} ${classes.panelTop}`} />
          <div id="bottomRight" className={`${classes.slot} ${classes.panel} ${classes.panelBottom}`} />
        </div>
      </div>
    </div>
  );
}
