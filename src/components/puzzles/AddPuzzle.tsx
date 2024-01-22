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
import { Dispatch, SetStateAction, useState } from "react";
import { getDefaultPuzzleDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import ProgressButton from "../common/ProgressButton";
import { getPuzzleDatabases, PuzzleDatabase } from "@/utils/puzzles";
import useSWRImmutable from "swr/immutable";

function AddPuzzle({
  puzzleDbs,
  opened,
  setOpened,
  setPuzzleDbs,
}: {
  puzzleDbs: PuzzleDatabase[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabase[]>>;
}) {
  const { data: dbs, error } = useSWRImmutable(
    "default_puzzle_databases",
    getDefaultPuzzleDatabases,
  );

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Add Database"
    >
      <ScrollArea.Autosize mah={500} offsetScrollbars>
        <Stack>
          {dbs &&
            dbs.map((db, i) => (
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
              title="Error"
              color="red"
            >
              {"Failed to fetch the database's info from the server."}
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
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabase[]>>;
  puzzleDb: PuzzleDatabase;
  databaseId: number;
  initInstalled: boolean;
}) {
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "puzzles", name + ".db3");
    await invoke("download_file", {
      id,
      url,
      path,
    });
    setPuzzleDbs(await getPuzzleDatabases());
  }

  return (
    <Paper withBorder radius="md" p={0} key={puzzleDb.title}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            DATABASE
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
                SIZE
              </Text>
              <Text size="xs">{formatBytes(puzzleDb.storage_size)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                PUZZLES
              </Text>
              <Text size="xs">{formatNumber(puzzleDb.puzzle_count)}</Text>
            </Stack>
          </Group>
          <ProgressButton
            id={databaseId}
            progressEvent="download_progress"
            initInstalled={initInstalled}
            labels={{
              completed: "Installed",
              action: "Install",
              inProgress: "Downloading",
              finalizing: "Extracting",
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
