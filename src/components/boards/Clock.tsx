import { Paper, Progress, Text } from "@mantine/core";
import * as classes from "./Clock.css";

function Clock({
  color,
  turn,
  progress,
  clock,
}: {
  color: "white" | "black";
  turn: "white" | "black";
  progress: number;
  clock: number | undefined;
}) {
  return (
    <Paper
      className={color === "black" ? classes.blackClock : classes.whiteClock}
      styles={{
        root: {
          opacity: turn !== color ? 0.5 : 1,
          visibility: clock ? "visible" : "hidden",
          transition: "opacity 0.15s",
        },
      }}
    >
      <Text fz="lg" fw="bold" px="xs">
        {clock ? formatClock(clock) : "0:00"}
      </Text>
      <Progress
        size="xs"
        w="100%"
        value={progress * 100}
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
  let s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  s = (s % 3600) % 60;

  let timeString = `${minutes.toString().padStart(2, "0")}`;
  if (hours > 0) {
    timeString = `${hours}:${timeString}`;
  }
  if (seconds < 60) {
    timeString += `:${s.toFixed(1).padStart(4, "0")}`;
  } else {
    timeString += `:${Math.floor(s).toString().padStart(2, "0")}`;
  }
  return timeString;
}

export default Clock;
