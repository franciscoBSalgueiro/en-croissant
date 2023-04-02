import { Box, Card, createStyles, Loader, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const useStyles = createStyles((theme) => ({
  card: {
    cursor: "pointer",
    border: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],
    },
  },
}));

type Progress = {
  total: number;
  elapsed: number;
};

function ConvertButton({
  setOpen,
  loading,
}: {
  setOpen: (open: boolean) => void;
  loading: boolean;
}) {
  const { classes } = useStyles();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    async function getProgress() {
      await listen("convert_progress", (event) => {
        const progress = event.payload as number[];
        setProgress({ total: progress[0], elapsed: progress[1] / 1000 });
      });
    }
    getProgress();
  }, []);
  return (
    <Card
      withBorder
      radius="md"
      className={classes.card}
      component="button"
      type="button"
      onClick={() => setOpen(true)}
    >
      <Text weight={500} mb={10}>
        Add New
      </Text>
      {loading ? <Loader variant="dots" size={30} /> : <IconPlus size={30} />}

      {progress && loading && (
        <Box sx={{ display: "flex", justifyContent: "space-around" }}>
          <Text fz="xs">{progress.total} games</Text>
          <Text fz="xs" mb={10}>
            {(progress.total / progress.elapsed).toFixed(1)} games/s
          </Text>
        </Box>
      )}
    </Card>
  );
}

export default ConvertButton;
