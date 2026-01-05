import type { Chess } from "chessops";
import { match } from "ts-pattern";
import { type GameHeaders, type TreeNode, getNodeAtPath } from "./treeReducer";

function calculateProgress(
  root: TreeNode,
  timeControl: TimeControl | null,
  clock: number | null,
  tc: TimeControlField | null,
) {
  if (!clock) {
    return 0;
  }
  if (tc) {
    return clock / (tc.seconds / 1000);
  }
  if (timeControl && timeControl.length > 0) {
    return clock / (timeControl[0].seconds / 1000);
  }
  if (root.children.length > 0 && root.children[0].clock) {
    return clock / root.children[0].clock;
  }
  return 0;
}

export type TimeControlField = {
  seconds: number;
  increment?: number;
  moves?: number;
  sandclock?: boolean;
};

type TimeControl = TimeControlField[];

type ClockInfo = {
  progress: number;
  value: number | undefined;
};

function secondsToDisplay(seconds: number) {
  if (seconds === 0) {
    return "0";
  }
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

function parseTimeValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.endsWith("''")) {
    const num = Number.parseFloat(trimmed.slice(0, -2).trim());
    return Number.isFinite(num) ? num : undefined;
  }

  if (trimmed.endsWith("'")) {
    const num = Number.parseFloat(trimmed.slice(0, -1).trim());
    return Number.isFinite(num) ? num * 60 : undefined;
  }

  const num = Number.parseFloat(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

function formatDescriptor(descriptor: string): string {
  if (descriptor === "?") {
    return "Unknown";
  }
  if (descriptor === "-") {
    return "No time control";
  }
  if (descriptor.startsWith("*")) {
    const seconds = parseTimeValue(descriptor.slice(1));
    if (Number.isFinite(seconds)) {
      return `Sandclock ${secondsToDisplay(seconds!)}`;
    }
    return descriptor;
  }
  if (descriptor.includes("/")) {
    const [moves, seconds] = descriptor.split("/");
    const movesNum = Number.parseInt(moves);
    const secondsNum = parseTimeValue(seconds);
    if (Number.isFinite(movesNum) && Number.isFinite(secondsNum)) {
      return `${movesNum}/${secondsToDisplay(secondsNum!)}`;
    }
    return descriptor;
  }

  if (descriptor.includes("+")) {
    const [base, increment] = descriptor
      .split("+")
      .map((v) => parseTimeValue(v));
    if (Number.isFinite(base) && Number.isFinite(increment)) {
      if (increment === 0) {
        return secondsToDisplay(base!);
      }
      return `${secondsToDisplay(base!)} + ${secondsToDisplay(increment!)}`;
    }
    return descriptor;
  }

  const base = parseTimeValue(descriptor);
  if (Number.isFinite(base)) {
    return secondsToDisplay(base!);
  }

  return descriptor;
}

export function formatTimeControl(
  timeControl: string | null | undefined,
): string {
  if (!timeControl) {
    return "Unknown";
  }

  const normalized = timeControl.trim();

  if (/[a-zA-Z]/.test(normalized)) {
    return "Exotic";
  }

  return normalized
    .split(":")
    .map((descriptor) => formatDescriptor(descriptor))
    .join(" : ");
}

function parseTimeControl(timeControl: string): TimeControl {
  const normalized = timeControl.trim();
  return normalized
    .split(":")
    .map((field) => field.trim())
    .reduce<TimeControl>((acc, field) => {
      if (!field || field === "?" || field === "-") {
        return acc;
      }

      if (field.startsWith("*")) {
        const seconds = parseTimeValue(field.slice(1));
        if (Number.isFinite(seconds)) {
          acc.push({ seconds: seconds! * 1000, sandclock: true });
        }
        return acc;
      }

      if (field.includes("/")) {
        const [moves, seconds] = field.split("/");
        const movesNum = Number.parseInt(moves);
        const secondsNum = parseTimeValue(seconds);
        if (Number.isFinite(movesNum) && Number.isFinite(secondsNum)) {
          acc.push({ seconds: secondsNum! * 1000, moves: movesNum });
        }
        return acc;
      }

      if (field.includes("+")) {
        const [base, increment] = field
          .split("+")
          .map((v) => parseTimeValue(v));
        if (Number.isFinite(base) && Number.isFinite(increment)) {
          acc.push({
            seconds: base! * 1000,
            increment: increment! * 1000,
          });
        }
        return acc;
      }

      const base = parseTimeValue(field);
      if (Number.isFinite(base)) {
        acc.push({ seconds: base! * 1000 });
      }
      return acc;
    }, []);
}

export function getClockInfo({
  headers,
  root,
  currentClock,
  pos,
  position,
  whiteTime,
  blackTime,
}: {
  headers: GameHeaders;
  root: TreeNode;
  currentClock: number | undefined;
  pos: Chess | null;
  position: number[];
  whiteTime?: number;
  blackTime?: number;
}): {
  white: ClockInfo;
  black: ClockInfo;
} {
  const timeControl = headers.time_control
    ? parseTimeControl(headers.time_control)
    : null;

  let whiteTc: TimeControlField | null = null;
  let blackTc: TimeControlField | null = null;

  if (headers.white_time_control) {
    whiteTc = parseTimeControl(headers.white_time_control)[0] ?? null;
  } else if (timeControl) {
    whiteTc = timeControl[0] ?? null;
  }
  if (headers.black_time_control) {
    blackTc = parseTimeControl(headers.black_time_control)[0] ?? null;
  } else if (timeControl) {
    blackTc = timeControl[0] ?? null;
  }

  let { whiteSeconds, blackSeconds } = match(pos?.turn)
    .with("white", () => ({
      whiteSeconds: getNodeAtPath(root, position.slice(0, -1))?.clock,
      blackSeconds: currentClock,
    }))
    .with("black", () => ({
      whiteSeconds: currentClock,
      blackSeconds: getNodeAtPath(root, position.slice(0, -1))?.clock,
    }))
    .otherwise(() => {
      return {
        whiteSeconds: undefined,
        blackSeconds: undefined,
      };
    });
  if (position.length <= 1 && timeControl) {
    if (timeControl.length > 0) {
      const seconds = timeControl[0].seconds / 1000;
      if (!whiteSeconds) {
        whiteSeconds = seconds;
      }
      if (!blackSeconds) {
        blackSeconds = seconds;
      }
    }
  }
  if (whiteTime) {
    whiteSeconds = whiteTime / 1000;
  }
  if (blackTime) {
    blackSeconds = blackTime / 1000;
  }

  return {
    white: {
      value: whiteSeconds,
      progress: calculateProgress(
        root,
        timeControl,
        whiteSeconds ?? null,
        whiteTc,
      ),
    },
    black: {
      value: blackSeconds,
      progress: calculateProgress(
        root,
        timeControl,
        blackSeconds ?? null,
        blackTc,
      ),
    },
  };
}
