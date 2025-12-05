import { Box, Button, Progress, useMantineTheme } from "@mantine/core";
import {
  type EventCallback,
  type UnlistenFn,
  listen,
} from "@tauri-apps/api/event";
import { memo, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { activeDownloadAtom } from "@/state/atoms";
import * as classes from "./ProgressButton.css";

type Payload = {
  id: string;
  progress: number;
  finished: boolean;
};

type Props<T> = {
  id: string;
  initInstalled: boolean;
  progressEvent: { listen: (handler: EventCallback<T>) => Promise<UnlistenFn> };
  onClick: (id: string) => void;
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
  lockDownloads?: boolean; // whether starting a task should use the global download lock
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
  lockDownloads = true,
}: Props<T>) {
  const [activeDownload, setActiveDownload] = useAtom(activeDownloadAtom);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(initInstalled);

  useEffect(() => {
    const unlisten = progressEvent.listen(async ({ payload }) => {
      if (payload.id !== id) return;
      if (payload.finished) {
        setInProgress(false);
        setCompleted(true);
        setProgress(0);
        // If this was the active global download, clear it
        if (lockDownloads && activeDownload === id) {
          setActiveDownload(null);
        }
      } else {
        setProgress(payload.progress);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [id, activeDownload, lockDownloads, setActiveDownload]);

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
          // prevent starting another global download while one is active
          if (lockDownloads) {
            if (activeDownload !== null && activeDownload !== id) return;
            setActiveDownload(id);
          }
          onClick(id);
        }}
        color={completed ? "green" : theme.primaryColor}
        disabled={
          inProgress || (completed && !redoable) || disabled ||
          (lockDownloads && activeDownload !== null && activeDownload !== id)
        }
        leftSection={<Box className={classes.label}>{leftIcon}</Box>}
        autoContrast
      >
        <span className={classes.label}>{label}</span>
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
