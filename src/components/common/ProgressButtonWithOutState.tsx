import { Box, Button, Progress, useMantineTheme } from "@mantine/core";
import { memo } from "react";
import * as classes from "./ProgressButtonWithOutState.css";

type Props = {
  id: string;
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
  progress: number;
  completed: boolean;
};

function ProgressButtonWithOutState({
  id,
  onClick,
  leftIcon,
  labels,
  disabled,
  redoable,
  inProgress,
  progress,
  completed,
}: Props) {
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
        disabled={inProgress || (completed && !redoable) || disabled}
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

export default memo(ProgressButtonWithOutState);
