import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { open } from "@tauri-apps/api/dialog";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Dispatch, SetStateAction, useState } from "react";
import { DatabaseInfo, getDatabases, useDefaultDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import FileInput from "../common/FileInput";
import ProgressButton from "../common/ProgressButton";

function AddDatabase({
  databases,
  opened,
  setOpened,
  setLoading,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setDatabases: Dispatch<SetStateAction<DatabaseInfo[]>>;
}) {
  const { defaultDatabases, error, isLoading } = useDefaultDatabases(opened);

  async function convertDB(path: string, title: string, description?: string) {
    setLoading(true);
    await invoke("convert_pgn", { file: path, title, description }).catch(
      () => {
        setLoading(false);
      }
    );
    setDatabases(await getDatabases());
    setLoading(false);
  }

  const form = useForm<DatabaseInfo>({
    initialValues: {
      title: "",
      description: "",
      file: "",
      filename: "",
      indexed: false,
    },

    validate: {
      title: (value) => {
        if (!value) return "Name is required";
        if (databases.find((e) => e.title === value))
          return "Name already used";
      },
      file: (value) => {
        if (!value) return "Path is required";
      },
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Add Database"
    >
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">Web</Tabs.Tab>
          <Tabs.Tab value="local">Local</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize h={500} offsetScrollbars>
            <Stack>
              {defaultDatabases &&
                defaultDatabases.map((db, i) => (
                  <DatabaseCard
                    database={db}
                    databaseId={i}
                    key={i}
                    setDatabases={setDatabases}
                    initInstalled={databases.some((e) => e.title === db.title)}
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
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              convertDB(values.file, values.title!, values.description);
              setOpened(false);
            })}
          >
            <TextInput
              label="Title"
              withAsterisk
              {...form.getInputProps("title")}
            />

            <TextInput
              label="Description"
              {...form.getInputProps("description")}
            />

            <FileInput
              label="PGN file"
              description="Click to select the PGN file"
              onClick={async () => {
                const selected = await open({
                  multiple: false,
                  filters: [
                    {
                      name: "PGN file",
                      extensions: ["pgn", "pgn.zst"],
                    },
                  ],
                });
                if (!selected || typeof selected === "object") return;
                form.setFieldValue("file", selected);
                const filename = selected.split(/(\\|\/)/g).pop();
                if (filename) {
                  form.setFieldValue("filename", filename);
                }
              }}
              filename={form.values.filename}
              {...form.getInputProps("path")}
            />

            <Button fullWidth mt="xl" type="submit">
              Convert
            </Button>
          </form>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function DatabaseCard({
  setDatabases,
  database,
  databaseId,
  initInstalled,
}: {
  setDatabases: Dispatch<SetStateAction<DatabaseInfo[]>>;
  database: DatabaseInfo;
  databaseId: number;
  initInstalled: boolean;
}) {
  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "db", name + ".db3");
    await invoke("download_file", {
      id,
      url,
      path,
    });
    setDatabases(await getDatabases());
  }

  return (
    <Paper
      withBorder
      radius="md"
      p={0}
      key={database.title}
    >
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            DATABASE
          </Text>
          <Text fw="bold" mb="xs">
            {database.title}
          </Text>

          <Text size="xs" c="dimmed">
            {database.description}
          </Text>
          <Divider />
          <Group wrap="nowrap" grow my="md">
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                SIZE
              </Text>
              <Text size="xs">{formatBytes(database.storage_size)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                GAMES
              </Text>
              <Text size="xs">{formatNumber(database.game_count)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                PLAYERS
              </Text>
              <Text size="xs">{formatNumber(database.player_count)}</Text>
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
                database.downloadLink!,
                database.title!
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

export default AddDatabase;
