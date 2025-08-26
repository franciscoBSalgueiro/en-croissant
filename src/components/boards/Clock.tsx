import { positionFromFen } from "@/utils/chessops";
import { getClockInfo } from "@/utils/clock";
import { Paper, Progress, Text } from "@mantine/core";
import { useContext } from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { TreeStateContext } from "../common/TreeStateContext";
import * as classes from "./Clock.css";

function Clock({
  color,
  turn,
  whiteTime,
  blackTime,
}: {
  color: "white" | "black";
  turn: "white" | "black";
  whiteTime?: number;
  blackTime?: number;
}) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const headers = useStore(store, (s) => s.headers);
  const currentNode = useStore(store, (s) => s.currentNode());
  const [pos, error] = positionFromFen(currentNode.fen);

  const { white, black } = getClockInfo({
    headers,
    root,
    currentClock: currentNode.clock,
    position,
    pos,
    whiteTime,
    blackTime,
  });

  const clock = match(color)
    .with("white", () => white.value)
    .with("black", () => black.value)
    .otherwise(() => undefined);
  const progress = match(color)
    .with("white", () => white.progress)
    .with("black", () => black.progress)
    .otherwise(() => 0);

  return (
    <Paper
      className={color === "black" ? classes.blackClock : classes.whiteClock}
      styles={{
        root: {
          opacity: turn !== color ? 0.5 : 1,
          visibility: "visible",
          transition: "opacity 0.15s",
          width: "80px",
          minWidth: "80px",
          maxWidth: "80px",
        },
      }}
    >
       <Text fz="lg" fw="bold" px="xs" ta="center">
         {clock ? formatClock(clock) : "00:00"}
       </Text>
      <Progress
        size="xs"
        w="100%"
        value={Math.max(0, Math.min(1, progress)) * 100}
        animated={turn === color}
        styles={{
          section: {
            animationDirection: "reverse",
          },
        }}
      />
    </Paper>
  );
}

function formatClock(seconds: number) {
  const negative = seconds < 0;
  let sAbs = Math.abs(seconds);
  const hours = Math.floor(sAbs / 3600);
  const minutes = Math.floor((sAbs % 3600) / 60);
  const secs = Math.floor(sAbs % 60);

  // Always use mm:ss format for stable width
  let timeString = `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  
  // Only show hours if > 0
  if (hours > 0) {
    timeString = `${hours}:${timeString}`;
  }
  
  return negative ? `-${timeString}` : timeString;
}

export default Clock;
