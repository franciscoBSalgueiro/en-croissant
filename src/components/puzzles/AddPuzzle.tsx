import { type PuzzleDatabaseInfo, commands } from "@/bindings";
import { getDefaultPuzzleDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { getPuzzleDatabases } from "@/utils/puzzles";
import {
  Alert,
  Box,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import ProgressButton from "../common/ProgressButton";

function AddPuzzle({
  puzzleDbs,
  opened,
  setOpened,
  setPuzzleDbs,
}: {
  puzzleDbs: PuzzleDatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabaseInfo[]>>;
}) {
  const { t } = useTranslation();
  const { data: dbs, error } = useSWRImmutable(
    "default_puzzle_databases",
    getDefaultPuzzleDatabases,
  );

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Databases.Add.Title")}
    >
      <ScrollArea.Autosize mah={500} offsetScrollbars>
        <Stack>
          {dbs?.map((db, i) => (
            <PuzzleDbCard
              puzzleDb={db}
              databaseId={i}
              key={i}
              setPuzzleDbs={setPuzzleDbs}
              initInstalled={puzzleDbs.some((e) => e.title === db.title)}
            />
          ))}
          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title={t("Common.Error")}
              color="red"
            >
              {t("Databases.Add.ErrorFetch")}
            </Alert>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Modal>
  );
}

function PuzzleDbCard({
  setPuzzleDbs,
  puzzleDb,
  databaseId,
  initInstalled,
}: {
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabaseInfo[]>>;
  puzzleDb: PuzzleDatabaseInfo & { downloadLink: string };
  databaseId: number;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "puzzles", `${name}.db3`);
    await commands.downloadFile(`puzzle_db_${id}`, url, path, null, null, null);
    setPuzzleDbs(await getPuzzleDatabases());
  }

  return (
    <Paper withBorder radius="md" p={0} key={puzzleDb.title}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            {t("Puzzle.Database")}
          </Text>
          <Text fw="bold" mb="xs">
            {puzzleDb.title}
          </Text>

          <Text size="xs" c="dimmed">
            {puzzleDb.description}
          </Text>
          <Divider />
          <Group wrap="nowrap" grow my="md">
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Common.Size")}
              </Text>
              <Text size="xs">{formatBytes(puzzleDb.storageSize)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Puzzle.Puzzles")}
              </Text>
              <Text size="xs">{formatNumber(puzzleDb.puzzleCount)}</Text>
            </Stack>
          </Group>
          <ProgressButton
            id={`puzzle_db_${databaseId}`}
            initInstalled={initInstalled}
            labels={{
              completed: t("Common.Installed"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
            }}
            onClick={() =>
              downloadDatabase(
                databaseId,
                puzzleDb.downloadLink!,
                puzzleDb.title,
              )
            }
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </Box>
      </Group>
    </Paper>
  );
}

export default AddPuzzle;
