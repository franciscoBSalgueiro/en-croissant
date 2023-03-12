import { Button, createStyles, Progress } from "@mantine/core";

const useStyles = createStyles((theme) => ({
  button: {
    position: "relative",
    transition: "background-color 150ms ease",
    ":disabled": {
      backgroundColor: theme.colors.green[7],
      color: theme.colors.gray[2],
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

export function ProgressButton({
  loaded,
  progress,
  onClick,
  id,
}: {
  loaded: boolean;
  progress: number;
  onClick: (id: number) => void;
  id: number;
}) {
  const { classes, theme } = useStyles();
  let label: string;
  if (loaded) {
    label = "Installed";
  } else {
    if (progress === 0) label = "Install";
    else if (progress === 100) label = "Extracting";
    else label = "Downloading";
  }

  return (
    <Button
      fullWidth
      className={classes.button}
      onClick={() => onClick(id)}
      disabled={loaded}
      color={loaded ? "green" : theme.primaryColor}
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
