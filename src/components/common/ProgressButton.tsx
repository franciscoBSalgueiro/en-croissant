import { ActionIcon, Box, Button, Group, Progress } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { useProgress } from "@/hooks/useProgress";
import * as classes from "./ProgressButton.css";

type Props = {
  id: string;
  initInstalled: boolean;
  onClick: (id: string) => void;
  onCancel?: () => void;
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

export default function ProgressButton({
  id,
  initInstalled,
  onClick,
  onCancel,
  leftIcon,
  labels,
  disabled,
  redoable,
  inProgress,
  setInProgress,
}: Props) {
  const { progress, finished, isActive, clear } = useProgress(id);
  const completed = initInstalled || finished;

  const showProgress = isActive || inProgress;

  useEffect(() => {
    if (finished) {
      setInProgress(false);
    }
  }, [finished, setInProgress]);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    clear();
    setInProgress(false);
  };

  let label: string;
  if (completed) {
    label = labels.completed;
  } else {
    if (progress === 0 && !showProgress) label = labels.action;
    else if (progress === 100) label = labels.finalizing ?? labels.inProgress;
    else label = labels.inProgress;
  }

  return (
    <Group gap="xs" wrap="nowrap">
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
      {showProgress && onCancel && (
        <ActionIcon
          variant="default"
          size="lg"
          onClick={handleCancel}
          title="Cancel"
        >
          <IconX size="1rem" />
        </ActionIcon>
      )}
    </Group>
  );
}
