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
  if (timeControl) {
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
};

type TimeControl = TimeControlField[];

type ClockInfo = {
  progress: number;
  value: number | undefined;
};

function parseTimeControl(timeControl: string): TimeControl {
  const fields = timeControl.split(":");
  const timeControlFields: TimeControl = [];
  for (const field of fields) {
    const match = field.match(/(?:(\d+)\/)?(\d+)(?:\+(\d+))?/);
    if (!match) {
      continue;
    }
    const moves = match[1];
    const seconds = match[2];
    const increment = match[3];
    const timeControlField: TimeControlField = {
      seconds: Number.parseInt(seconds) * 1000,
    };
    if (increment) {
      timeControlField.increment = Number.parseInt(increment) * 1000;
    }
    if (moves) {
      timeControlField.moves = Number.parseInt(moves);
    }
    timeControlFields.push(timeControlField);
  }
  return timeControlFields;
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
    whiteTc = parseTimeControl(headers.white_time_control)[0];
  } else if (timeControl) {
    whiteTc = timeControl[0];
  }
  if (headers.black_time_control) {
    blackTc = parseTimeControl(headers.black_time_control)[0];
  } else if (timeControl) {
    blackTc = timeControl[0];
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
