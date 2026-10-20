import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { ActionIcon, Box, Button, Group, Progress } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { commands } from "@/bindings";
import { formatBytes } from "@/utils/format";
import { useProgress } from "@/hooks/useProgress";
import classes from "./ProgressButton.module.css";

type Props = {
  id: string;
  initInstalled: boolean;
  onClick: (id: string) => void | Promise<void>;
  onCancel?: () => void;
  cancellableDownload?: boolean;
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
  onCancel,
  cancellableDownload = false,
  leftIcon,
  labels,
  disabled,
  redoable,
  inProgress,
  setInProgress,
}: Props) {
  const { t } = useTranslation();
  const [cancelling, setCancelling] = useState(false);
  const isDownload = cancellableDownload;
  const { progress, finished, isActive, clear, bytesPerSecond } = useProgress(id);
  const showProgress = isActive || inProgress;
  // Engine registration is optimistic in Jotai; persistence may still fail.
  const completed = (initInstalled || finished) && !(isDownload && showProgress);

  useEffect(() => {
    if (finished) {
      setInProgress(false);
    }
  }, [finished, setInProgress]);

  const handleCancel = useCallback(async () => {
    if (isDownload && !onCancel) {
      setCancelling(true);
      try {
        await commands.cancelDownload(id);
      } catch (error) {
        notifications.show({ color: "red", message: String(error) });
      } finally {
        setCancelling(false);
      }
      return;
    }
    if (onCancel) {
      onCancel();
    }
    clear();
    setInProgress(false);
  }, [onCancel, clear, setInProgress, isDownload, id]);

  let label: string;
  if (completed) {
    label = labels.completed;
  } else {
    if (progress === 0 && !showProgress) label = labels.action;
    else if (progress === 100) label = labels.finalizing ?? labels.inProgress;
    else label = labels.inProgress;
  }

  const speedLabel =
    isDownload && showProgress && !completed && progress < 100
      ? `${bytesPerSecond && bytesPerSecond > 0 ? formatBytes(bytesPerSecond, 1) : "0 KB"}/s`
      : null;

  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        fullWidth
        onClick={async () => {
          if (!isDownload) return onClick(id);
          try {
            await onClick(id);
          } catch (error) {
            if (!String(error).includes("Download cancelled")) {
              notifications.show({ color: "red", message: String(error) });
            }
          } finally {
            clear();
            setInProgress(false);
          }
        }}
        disabled={showProgress || (completed && !redoable) || disabled}
        leftSection={<Box className={classes.label}>{leftIcon}</Box>}
        autoContrast
      >
        <span className={classes.label}>
          {label}
          {speedLabel !== null ? ` · ${speedLabel}` : ""}
        </span>
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
      {showProgress && (onCancel || (isDownload && isActive && progress < 100)) && (
        <ActionIcon
          variant="default"
          size="lg"
          onClick={handleCancel}
          disabled={cancelling}
          aria-label={t("Common.Cancel")}
          title={t("Common.Cancel")}
        >
          <IconX size="1rem" />
        </ActionIcon>
      )}
    </Group>
  );
}

export default memo(ProgressButton);
