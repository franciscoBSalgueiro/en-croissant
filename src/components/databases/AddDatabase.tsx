import { events, type DatabaseInfo, commands } from "@/bindings";
import {
  type SuccessDatabaseInfo,
  getDatabases,
  useDefaultDatabases,
} from "@/utils/db";
import { capitalize, formatBytes, formatNumber } from "@/utils/format";
import { unwrap } from "@/utils/unwrap";
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
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeyedMutator } from "swr";
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
  setDatabases: KeyedMutator<DatabaseInfo[]>;
}) {
  const { t } = useTranslation();
  const { defaultDatabases, error, isLoading } = useDefaultDatabases(opened);

  async function convertDB(path: string, title: string, description?: string) {
    setLoading(true);
    const dbPath = await resolve(await appDataDir(), "db", `${title}.db3`);
    unwrap(
      await commands.convertPgn(path, dbPath, null, title, description ?? null),
    );
    setDatabases(await getDatabases());
    setLoading(false);
  }

  const form = useForm<Partial<Extract<DatabaseInfo, { type: "success" }>>>({
    initialValues: {
      title: "",
      description: "",
      file: "",
      filename: "",
      indexed: false,
    },

    validate: {
      title: (value) => {
        if (!value) return t("Common.RequireName");
        if (databases.find((e) => e.type === "success" && e.title === value))
          return t("Common.NameAlreadyUsed");
      },
      file: (value) => {
        if (!value) return t("Common.RequirePath");
      },
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Databases.Add.Title")}
    >
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">{t("Databases.Add.Web")}</Tabs.Tab>
          <Tabs.Tab value="local">{t("Common.Local")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize h={500} offsetScrollbars>
            <Stack>
              {defaultDatabases?.map((db, i) => (
                <DatabaseCard
                  database={db}
                  databaseId={i}
                  key={i}
                  setDatabases={setDatabases}
                  initInstalled={databases.some(
                    (e) =>
                      e.type === "success" &&
                      db.type === "success" &&
                      e.title === db.title,
                  )}
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
              convertDB(values.file!, values.title!, values.description);
              setOpened(false);
            })}
          >
            <TextInput
              label={t("Common.Name")}
              withAsterisk
              {...form.getInputProps("title")}
            />

            <TextInput
              label={t("Common.Description")}
              {...form.getInputProps("description")}
            />

            <FileInput
              label={t("Common.PGNFile")}
              description={t("Databases.Add.ClickToSelectPGN")}
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
                  if (!form.values.title) {
                    form.setFieldValue(
                      "title",
                      capitalize(
                        filename.replaceAll(/[_-]/g, " ").replace(".pgn", ""),
                      ),
                    );
                  }
                }
              }}
              filename={form.values.filename ?? null}
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
  setDatabases: KeyedMutator<DatabaseInfo[]>;
  database: SuccessDatabaseInfo;
  databaseId: number;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();

  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "db", `${name}.db3`);
    await commands.downloadFile(`db_${id}`, url, path, null, null, null);
    setDatabases(await getDatabases());
  }

  return (
    <Paper withBorder radius="md" p={0} key={database.title}>
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
                {t("Common.Size")}
              </Text>
              <Text size="xs">{formatBytes(database.storage_size ?? 0)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Databases.Card.Games")}
              </Text>
              <Text size="xs">{formatNumber(database.game_count)}</Text>
            </Stack>
            <Stack gap={0} align="center">
              <Text tt="uppercase" c="dimmed" fw={700} size="xs">
                {t("Databases.Card.Players")}
              </Text>
              <Text size="xs">{formatNumber(database.player_count)}</Text>
            </Stack>
          </Group>
          <ProgressButton
            id={`db_${databaseId}`}
            progressEvent={events.downloadProgress}
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
                database.downloadLink!,
                database.title!,
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
