import { useProgress } from "@/hooks/useProgress";
import { Box, Button, Progress } from "@mantine/core";
import { memo, useEffect } from "react";
import * as classes from "./ProgressButton.css";

type Props = {
  id: string;
  initInstalled: boolean;
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
};

function ProgressButton({
  id,
  initInstalled,
  onClick,
  leftIcon,
  labels,
  disabled,
  redoable,
  inProgress,
  setInProgress,
}: Props) {
  const { progress, finished, isActive } = useProgress(id);
  const completed = initInstalled || finished;

  const showProgress = isActive || inProgress;

  useEffect(() => {
    if (finished) {
      setInProgress(false);
    }
  }, [finished, setInProgress]);

  let label: string;
  if (completed) {
    label = labels.completed;
  } else {
    if (progress === 0 && !showProgress) label = labels.action;
    else if (progress === 100) label = labels.finalizing ?? labels.inProgress;
    else label = labels.inProgress;
  }

  return (
    <>
      <Button
        fullWidth
        onClick={() => {
          onClick(id);
        }}
        disabled={showProgress || (completed && !redoable) || disabled}
        leftSection={<Box className={classes.label}>{leftIcon}</Box>}
        autoContrast
      >
        <span className={classes.label}>{label}</span>
        {!completed && progress !== 0 && (
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
