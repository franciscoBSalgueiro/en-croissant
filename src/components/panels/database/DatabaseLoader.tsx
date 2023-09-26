import { Progress } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

type ProgressPayload = {
  id: string;
  progress: number;
  finished: boolean;
};

function DatabaseLoader({
  isLoading,
  tab,
}: {
  isLoading: boolean;
  tab: string | null;
}) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function getProgress() {
      console.log("listening for progress on tab", tab);
      const unlisten = await listen<ProgressPayload>(
        "download_progress",
        async ({ payload }) => {
          if (payload.id !== tab) return;
          if (payload.finished) {
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

  const isLoadingFromMemory = isLoading && progress === 0;

  return (
    <Progress
      animate={isLoadingFromMemory}
      value={isLoadingFromMemory ? 100 : progress}
      size="xs"
      mt="xs"
    />
  );
}

export default DatabaseLoader;
