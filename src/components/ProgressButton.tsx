import { Button, createStyles, Progress } from "@mantine/core";

const useStyles = createStyles(() => ({
  button: {
    position: "relative",
    transition: "background-color 150ms ease",
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
  onClick: (loaded: boolean, id: number) => void;
  id: number;
}) {
  const { classes, theme } = useStyles();

  return (
    <Button
      fullWidth
      className={classes.button}
      onClick={() => onClick(loaded, id)}
      color={loaded ? "red" : theme.primaryColor}
    >
      <div className={classes.label}>
        {progress !== 0 ? "Installing" : loaded ? "Remove" : "Install"}
      </div>
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
