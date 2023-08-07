import {
  Alert,
  Card,
  createStyles,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { getDefaultPuzzleDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import ProgressButton from "../common/ProgressButton";
import { getPuzzleDatabases, PuzzleDatabase } from "@/utils/puzzles";

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  title: {
    fontWeight: 700,
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    lineHeight: 1.2,
  },

  body: {
    padding: theme.spacing.md,
  },
}));

function AddPuzzle({
  puzzleDbs,
  opened,
  setOpened,
  setLoading,
  setPuzzleDbs,
}: {
  puzzleDbs: PuzzleDatabase[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPuzzleDbs: Dispatch<SetStateAction<PuzzleDatabase[]>>;
}) {
  const [defaultdatabases, setDefaultDatabases] = useState<PuzzleDatabase[]>(
    []
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    getDefaultPuzzleDatabases()
      .then((dbs) => {
        setDefaultDatabases(dbs);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Add Database"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack>
        {defaultdatabases.map((db, i) => (
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
      zip: false,
      path,
    });
    setPuzzleDbs(await getPuzzleDatabases());
  }
  const { classes } = useStyles();

  return (
    <Card
      withBorder
      radius="md"
      p={0}
      key={puzzleDb.title}
      className={classes.card}
    >
      <Group noWrap spacing={0} grow>
        <div className={classes.body}>
          <Text transform="uppercase" color="dimmed" weight={700} size="xs">
            DATABASE
          </Text>
          <Text className={classes.title} mb="xs">
            {puzzleDb.title}
          </Text>

          <Text size="xs" color="dimmed">
            {puzzleDb.description}
          </Text>
          <Divider />
          <Group noWrap grow my="md">
            <Stack spacing={0} align="center">
              <Text transform="uppercase" color="dimmed" weight={700} size="xs">
                SIZE
              </Text>
              <Text size="xs">{formatBytes(puzzleDb.storage_size)}</Text>
            </Stack>
            <Stack spacing={0} align="center">
              <Text transform="uppercase" color="dimmed" weight={700} size="xs">
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
                puzzleDb.title
              )
            }
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </div>
      </Group>
    </Card>
  );
}

export default AddPuzzle;
