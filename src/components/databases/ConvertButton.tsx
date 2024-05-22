import * as classes from "@/components/common/GenericCard.css";
import { Box, Loader, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    async function getProgress() {
      await listen<number[]>("convert_progress", (event) => {
        const progress = event.payload;
        setProgress({ total: progress[0], elapsed: progress[1] / 1000 });
      });
    }
    getProgress();
  }, []);
  return (
    <Box
      className={classes.card}
      component="button"
      type="button"
      onClick={() => setOpen(true)}
    >
      <Stack gap={0} justify="center" w="100%" h="100%">
        <Text mb={10}>{t("Common.AddNew")}</Text>
        <Box>
          {loading ? (
            <Loader variant="dots" size="1.3rem" />
          ) : (
            <IconPlus size="1.3rem" />
          )}
        </Box>

        {progress && loading && (
          <Box style={{ display: "flex", justifyContent: "space-around" }}>
            <Text fz="xs">{progress.total} games</Text>
            <Text fz="xs" mb={10}>
              {(progress.total / progress.elapsed).toFixed(1)} games/s
            </Text>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

export default ConvertButton;
