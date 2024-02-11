import { Button, Progress, useMantineTheme } from "@mantine/core";
import { EventCallback, UnlistenFn, listen } from "@tauri-apps/api/event";
import { memo, useEffect, useState } from "react";
import * as classes from "./ProgressButton.css";

type Payload = {
  id: bigint;
  progress: number;
  finished: boolean;
};

type Props<T> = {
  id: number;
  initInstalled: boolean;
  progressEvent: { listen: (handler: EventCallback<T>) => Promise<UnlistenFn> };
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

function ProgressButton<T extends Payload>({
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
}: Props<T>) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(initInstalled);

  useEffect(() => {
    const unlisten = progressEvent.listen(async ({ payload }) => {
      if (Number(payload.id) !== id) return;
      if (payload.finished) {
        setInProgress(false);
        setCompleted(true);
        setProgress(0);
      } else {
        setProgress(payload.progress);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  let label: string;
  if (completed) {
    label = labels.completed;
  } else {
    if (progress === 0 && !inProgress) label = labels.action;
    else if (progress === 100) label = labels.finalizing ?? labels.inProgress;
    else label = labels.inProgress;
  }
  const theme = useMantineTheme();

  return (
    <>
      <Button
        fullWidth
        onClick={() => {
          onClick(id);
        }}
        color={completed ? "green" : theme.primaryColor}
        disabled={((inProgress || completed) && !redoable) || disabled}
        leftSection={leftIcon}
      >
        <div className={classes.label}>{label}</div>
        {progress !== 0 && (
          <Progress
            pos="absolute"
            h="100%"
            value={progress}
            className={classes.progress}
            radius="sm"
          />
        )}
      </Button>
    </>
  );
}

export default memo(ProgressButton);
