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
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { basename, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom, useSetAtom } from "jotai";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeyedMutator } from "swr";
import { commands, type DatabaseInfo } from "@/bindings";
import { databaseConversionStateAtom, storedDatabasesDirAtom } from "@/state/atoms";
import { getDatabases, type SuccessDatabaseInfo, useDefaultDatabases } from "@/utils/db";
import { capitalize, formatBytes, formatNumber } from "@/utils/format";
import { unwrap } from "@/utils/unwrap";
import FileInput from "../common/FileInput";
import ProgressButton from "../common/ProgressButton";

interface AddDatabaseFormValues {
  title: string;
  description: string;
  files: string[];
  filename: string;
}

function AddDatabase({
  databases,
  opened,
  setOpened,
  setLoading,
  disableLocalConversion,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  disableLocalConversion: boolean;
  setDatabases: KeyedMutator<DatabaseInfo[]>;
}) {
  const { t } = useTranslation();
  const [databaseDir] = useAtom(storedDatabasesDirAtom);
  const setConversionState = useSetAtom(databaseConversionStateAtom);

  const { defaultDatabases, error, isLoading } = useDefaultDatabases(opened);

  async function convertDB(paths: string[], title: string, description?: string) {
    if (paths.length === 0) return;
    setLoading(true);
    const dbPath = await resolve(databaseDir, `${title}.duckdb`);
    const sourceFileName = await basename(paths[0]);
    setConversionState((prev) => ({
      ...prev,
      inProgress: true,
      targetDatabasePath: dbPath,
      targetDatabaseTitle: title,
      sourceFileName,
    }));
    try {
      unwrap(await commands.convertPgn(paths, dbPath, null, title, description ?? null));
      await setDatabases(await getDatabases());
    } finally {
      setLoading(false);
      setConversionState((prev) => ({
        ...prev,
        inProgress: false,
        totalGames: 0,
        elapsedSeconds: 0,
        targetDatabasePath: null,
        targetDatabaseTitle: null,
        sourceFileName: null,
      }));
    }
  }

  const form = useForm<AddDatabaseFormValues>({
    initialValues: {
      title: "",
      description: "",
      files: [],
      filename: "",
    },

    validate: {
      title: (value) => {
        if (!value) return t("Common.RequireName");
        if (databases.find((e) => e.type === "success" && e.title === value))
          return t("Common.NameAlreadyUsed");
      },
      files: (value) => {
        if (value.length === 0) return t("Common.RequirePath");
      },
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Databases.Add.Title")}
      size="80%"
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
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {defaultDatabases?.map((db, i) => (
                <DatabaseCard
                  database={db}
                  databaseId={i}
                  key={i}
                  setDatabases={setDatabases}
                  initInstalled={databases.some(
                    (e) => e.type === "success" && e.title === db.title,
                  )}
                />
              ))}
              {error && (
                <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red">
                  {"Failed to fetch the database's info from the server."}
                </Alert>
              )}
            </SimpleGrid>
          </ScrollArea.Autosize>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              if (disableLocalConversion) return;
              await convertDB(values.files, values.title, values.description);
              setOpened(false);
            })}
          >
            <TextInput label={t("Common.Name")} withAsterisk {...form.getInputProps("title")} />

            <TextInput label={t("Common.Description")} {...form.getInputProps("description")} />

            <FileInput
              label={t("Common.PGNFile")}
              description={t("Databases.Add.ClickToSelectPGN")}
              onClick={async () => {
                const selected = await open({
                  multiple: true,
                  filters: [
                    {
                      name: "PGN file",
                      extensions: ["pgn", "pgn.zst"],
                    },
                  ],
                });
                if (!selected) return;

                const selectedFiles = Array.isArray(selected) ? selected : [selected];
                form.setFieldValue("files", selectedFiles);

                const filenames = await Promise.all(selectedFiles.map((file) => basename(file)));
                const firstFilename = filenames[0];
                if (firstFilename) {
                  const displayName =
                    filenames.length > 1
                      ? `${firstFilename} (+${filenames.length - 1})`
                      : firstFilename;
                  form.setFieldValue("filename", displayName);
                  if (!form.values.title) {
                    form.setFieldValue(
                      "title",
                      capitalize(
                        firstFilename.replaceAll(/[_-]/g, " ").replace(/\.pgn(\.(zst|bz2))?$/i, ""),
                      ),
                    );
                  }
                }
              }}
              filename={form.values.filename ?? null}
              error={form.errors.files}
            />

            <Button fullWidth mt="xl" type="submit" disabled={disableLocalConversion}>
              {t("Databases.Add.Convert")}
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
  const [databaseDir] = useAtom(storedDatabasesDirAtom);

  const [inProgress, setInProgress] = useState<boolean>(false);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(databaseDir, `${name}.duckdb`);
    await commands.downloadFile(`db_${id}`, url, path, null, null, null);
    await setDatabases(await getDatabases());
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
            initInstalled={initInstalled}
            labels={{
              completed: t("Common.Installed"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
            }}
            onClick={() => downloadDatabase(databaseId, database.downloadLink!, database.title!)}
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </Box>
      </Group>
    </Paper>
  );
}

export default AddDatabase;
