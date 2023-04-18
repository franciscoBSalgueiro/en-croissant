import { Button, createStyles, Progress } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const useStyles = createStyles((theme, finished: boolean) => ({
  button: {
    position: "relative",
    transition: "background-color 150ms ease",
    ":disabled": {
      backgroundColor: finished ? theme.colors.green[7] : theme.colors.gray[7],
      color: finished ? theme.colors.gray[2] : theme.colors.gray[5],
    },
  },

  progress: {
    position: "absolute",
    bottom: -1,
    right: -1,
    left: -1,
    top: -1,
    height: "auto",
    backgroundColor: "transparent",
    zIndex: 0,
  },

  label: {
    position: "relative",
    zIndex: 1,
  },
}));

type ProgressPayload = {
  id: number;
  progress: number;
  finished: boolean;
};

type Props = {
  id: number;
  initInstalled: boolean;
  progressEvent: string;
  onClick: (id: number) => void;
  leftIcon?: React.ReactNode;
  labels: {
    completed: string;
    action: string;
    inProgress: string;
    finalizing?: string;
  };
  disabled?: boolean;
  redoable?: boolean;
  inProgress: boolean;
  setInProgress: (inProgress: boolean) => void;
};

export function ProgressButton({
  id,
  initInstalled,
  progressEvent,
  onClick,
  leftIcon,
  labels,
  disabled,
  redoable,
  inProgress,
  setInProgress,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(initInstalled);
  const { classes, theme } = useStyles(completed);

  useEffect(() => {
    async function getProgress() {
      const unlisten = await listen<ProgressPayload>(
        progressEvent,
        async ({ payload }) => {
          if (payload.id !== id) return;
          if (payload.finished) {
            setInProgress(false);
            setCompleted(true);
            setProgress(0);
            unlisten();
          } else {
            setProgress(payload.progress);
          }
        }
      );
    }
    getProgress();
  }, []);

  let label: string;
  if (completed) {
    label = labels.completed;
  } else {
    if (progress === 0 && !inProgress) label = labels.action;
    else if (progress === 100) label = labels.finalizing ?? labels.inProgress;
    else label = labels.inProgress;
  }

  return (
    <Button
      fullWidth
      className={classes.button}
      onClick={() => {
        onClick(id);
      }}
      disabled={(completed && !redoable) || disabled}
      color={completed ? "green" : theme.primaryColor}
      leftIcon={leftIcon}
    >
      <div className={classes.label}>{label}</div>
      {progress !== 0 && (
        <Progress
          value={progress}
          className={classes.progress}
          color={theme.fn.rgba(theme.colors[theme.primaryColor][2], 0.35)}
          radius="sm"
        />
      )}
    </Button>
  );
}
