import { commands } from "@/bindings";
import type { DatabaseInfo } from "@/bindings";
import { referenceDbAtom, selectedDatabaseAtom } from "@/state/atoms";
import { type SuccessDatabaseInfo, getDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { unwrap } from "@/utils/unwrap";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Paper,
  Rating,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useToggle } from "@mantine/hooks";
import { IconArrowRight, IconDatabase, IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import ConfirmModal from "../common/ConfirmModal";
import GenericCard from "../common/GenericCard";
import OpenFolderButton from "../common/OpenFolderButton";
import AddDatabase from "./AddDatabase";
import ConvertButton from "./ConvertButton";
import { PlayerSearchInput } from "./PlayerSearchInput";

export default function DatabasesPage() {
  const { t } = useTranslation();

  const {
    data: databases,
    error,
    isLoading,
    mutate,
  } = useSWR("databases", () => getDatabases());

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDatabase = useMemo(
    () => (databases ?? []).find((db) => db.file === selected) ?? null,
    [databases, selected],
  );
  const [, setStorageSelected] = useAtom(selectedDatabaseAtom);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const isReference = referenceDatabase === selectedDatabase?.file;

  const [deleteModal, toggleDeleteModal] = useToggle();
  const [convertLoading, setConvertLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  function changeReferenceDatabase(file: string) {
    commands.clearGames();
    if (file === referenceDatabase) {
      setReferenceDatabase(null);
    } else {
      setReferenceDatabase(file);
    }
  }
  const navigate = useNavigate();

  return (
    <Stack h="100%">
      <ConfirmModal
        title={t("Databases.Delete.Title")}
        description={t("Databases.Delete.Message")}
        opened={deleteModal}
        onClose={toggleDeleteModal}
        onConfirm={() => {
          commands.deleteDatabase(selectedDatabase?.file!).then(() => {
            mutate();
            setSelected(null);
          });
          toggleDeleteModal();
        }}
      />

      <AddDatabase
        databases={databases ?? []}
        opened={open}
        setOpened={setOpen}
        setLoading={setConvertLoading}
        setDatabases={mutate}
      />

      <Group align="baseline" pl="lg" py="sm">
        <Title>{t("Databases.Title")}</Title>
        <OpenFolderButton base="AppDir" folder="db" />
      </Group>

      <Group
        grow
        flex={1}
        style={{ overflow: "hidden" }}
        align="start"
        px="md"
        pb="md"
      >
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: "md", md: "sm" }}
          >
            {isLoading && (
              <>
                <Skeleton h="8rem" />
                <Skeleton h="8rem" />
                <Skeleton h="8rem" />
              </>
            )}
            {!isLoading &&
              databases?.map((item) => (
                <GenericCard
                  id={item.file}
                  key={item.filename}
                  isSelected={selectedDatabase?.filename === item.filename}
                  setSelected={setSelected}
                  error={item.type === "error" ? item.error : ""}
                  onDoubleClick={() => {
                    if (item.type === "error") return;
                    navigate({
                      to: "/databases/$databaseId",
                      params: {
                        databaseId: item.title,
                      },
                    });
                    setStorageSelected(item);
                  }}
                  Header={
                    <Group wrap="nowrap" justify="space-between">
                      <Group wrap="nowrap" miw={0}>
                        <IconDatabase size="1.5rem" />
                        <Box miw={0}>
                          <Text fw={500}>
                            {item.type === "success" ? item.title : item.error}
                          </Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            style={{ wordWrap: "break-word" }}
                          >
                            {item.type === "error"
                              ? item.file
                              : item.description}
                          </Text>
                        </Box>
                      </Group>
                      <Rating
                        value={referenceDatabase === item.file ? 1 : 0}
                        count={1}
                        onChange={() => {
                          changeReferenceDatabase(item.file);
                        }}
                      />
                    </Group>
                  }
                  stats={[
                    {
                      label: t("Databases.Card.Games"),
                      value:
                        item.type === "success"
                          ? formatNumber(item.game_count)
                          : "???",
                    },
                    {
                      label: t("Databases.Card.Storage"),
                      value:
                        item.type === "success"
                          ? formatBytes(item.storage_size ?? 0)
                          : "???",
                    },
                  ]}
                />
              ))}
            <ConvertButton setOpen={setOpen} loading={convertLoading} />
          </SimpleGrid>
        </ScrollArea>

        <Paper withBorder p="md" h="100%">
          {selectedDatabase === null ? (
            <Text ta="center">No database selected</Text>
          ) : (
            <ScrollArea h="100%" offsetScrollbars>
              <Stack>
                {selectedDatabase.type === "error" ? (
                  <>
                    <Text fz="lg" fw="bold">
                      There was an error loading this database
                    </Text>

                    <Text>
                      <Text td="underline" span>
                        Reason:
                      </Text>
                      {` ${selectedDatabase.error}`}
                    </Text>

                    <Text>
                      Check if the file exists and that it is not corrupted.
                    </Text>
                  </>
                ) : (
                  <>
                    <Divider
                      variant="dashed"
                      label={t("Common.GeneralSettings")}
                    />
                    <GeneralSettings
                      key={selectedDatabase.filename}
                      selectedDatabase={selectedDatabase}
                      mutate={mutate}
                    />
                    <Checkbox
                      label={t("Databases.Settings.ReferenceDatabase")}
                      checked={isReference}
                      onChange={() => {
                        changeReferenceDatabase(selectedDatabase.file);
                      }}
                    />
                    <IndexInput
                      indexed={selectedDatabase.indexed}
                      file={selectedDatabase.file}
                      setDatabases={mutate}
                    />

                    <Divider variant="dashed" label={t("Common.Data")} />
                    <Group grow>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Card.Games")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.game_count)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Card.Players")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.player_count)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          {t("Databases.Settings.Events")}
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.event_count)}
                        </Text>
                      </Stack>
                    </Group>

                    <div>
                      {selectedDatabase.type === "success" && (
                        <Button
                          component={Link}
                          to="/databases/$databaseId"
                          params={{ databaseId: selectedDatabase.title }}
                          onClick={() => setStorageSelected(selectedDatabase)}
                          fullWidth
                          variant="default"
                          size="lg"
                          rightSection={<IconArrowRight size="1rem" />}
                        >
                          {t("Databases.Settings.Explore")}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                <Divider
                  variant="dashed"
                  label={t("Databases.Settings.AdvancedTools")}
                />

                {selectedDatabase.type === "success" && (
                  <AdvancedSettings
                    selectedDatabase={selectedDatabase}
                    reload={mutate}
                  />
                )}

                <Divider
                  variant="dashed"
                  label={t("Databases.Settings.Actions")}
                />
                <Group justify="space-between">
                  {selectedDatabase.type === "success" && (
                    <Group>
                      <Button
                        variant="default"
                        rightSection={<IconPlus size="1rem" />}
                        onClick={async () => {
                          const file = await openDialog({
                            filters: [{ name: "PGN", extensions: ["pgn"] }],
                          });
                          if (!file || typeof file !== "string") return;
                          setConvertLoading(true);
                          await commands.convertPgn(
                            file,
                            selectedDatabase.file,
                            null,
                            "",
                            null,
                          );
                          mutate();
                          setConvertLoading(false);
                        }}
                      >
                        {t("Databases.Settings.AddGames")}
                      </Button>
                      <Button
                        rightSection={<IconArrowRight size="1rem" />}
                        variant="default"
                        loading={exportLoading}
                        onClick={async () => {
                          const destFile = await save({
                            filters: [{ name: "PGN", extensions: ["pgn"] }],
                          });
                          if (!destFile) return;
                          setExportLoading(true);
                          await commands.exportToPgn(
                            selectedDatabase.file,
                            destFile,
                          );
                          setExportLoading(false);
                        }}
                      >
                        {t("Databases.Settings.ExportPGN")}
                      </Button>
                    </Group>
                  )}
                  <Button onClick={() => toggleDeleteModal()} color="red">
                    {t("Common.Delete")}
                  </Button>
                </Group>
              </Stack>
            </ScrollArea>
          )}
        </Paper>
      </Group>
    </Stack>
  );
}

function GeneralSettings({
  selectedDatabase,
  mutate,
}: {
  selectedDatabase: SuccessDatabaseInfo;
  mutate: () => void;
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(selectedDatabase.title);
  const [description, setDescription] = useState(selectedDatabase.description);

  const [debouncedTitle] = useDebouncedValue(title, 300);
  const [debouncedDescription] = useDebouncedValue(description, 300);

  useEffect(() => {
    commands
      .editDbInfo(
        selectedDatabase.file,
        debouncedTitle ?? null,
        debouncedDescription ?? null,
      )
      .then(() => mutate());
  }, [debouncedTitle, debouncedDescription]);

  return (
    <>
      <TextInput
        label={t("Common.Name")}
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        error={title === "" && t("Common.RequireName")}
      />
      <Textarea
        label={t("Common.Description")}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
    </>
  );
}

function AdvancedSettings({
  selectedDatabase,
  reload,
}: {
  selectedDatabase: DatabaseInfo;
  reload: () => void;
}) {
  return (
    <Stack>
      <PlayerMerger selectedDatabase={selectedDatabase} />
      <DuplicateRemover selectedDatabase={selectedDatabase} reload={reload} />
    </Stack>
  );
}

function PlayerMerger({
  selectedDatabase,
}: {
  selectedDatabase: DatabaseInfo;
}) {
  const { t } = useTranslation();

  const [player1, setPlayer1] = useState<number | undefined>(undefined);
  const [player2, setPlayer2] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function mergePlayers() {
    if (player1 === undefined || player2 === undefined) {
      return;
    }
    setLoading(true);
    const res = await commands.mergePlayers(
      selectedDatabase.file,
      player1,
      player2,
    );
    setLoading(false);
    unwrap(res);
  }

  return (
    <Stack>
      <Text fz="lg" fw="bold">
        {t("Databases.Settings.MergePlayers")}
      </Text>
      <Text fz="sm">{t("Databases.Settings.MergePlayers.Desc")}</Text>
      <Group grow>
        <PlayerSearchInput
          label="Player 1"
          file={selectedDatabase.file}
          setValue={setPlayer1}
        />
        <Button
          loading={loading}
          onClick={mergePlayers}
          rightSection={<IconArrowRight size="1rem" />}
        >
          {t("Databases.Settings.Merge")}
        </Button>
        <PlayerSearchInput
          label="Player 2"
          file={selectedDatabase.file}
          setValue={setPlayer2}
        />
      </Group>
    </Stack>
  );
}

function DuplicateRemover({
  selectedDatabase,
  reload,
}: {
  selectedDatabase: DatabaseInfo;
  reload: () => void;
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  return (
    <Stack>
      <Text fz="lg" fw="bold">
        {t("Databases.Settings.BatchDelete")}
      </Text>
      <Text fz="sm">{t("Databases.Settings.BatchDelete.Desc")}</Text>
      <Group>
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            commands
              .deleteDuplicatedGames(selectedDatabase.file)
              .then(() => {
                setLoading(false);
                reload();
              })
              .catch(() => {
                setLoading(false);
                reload();
              });
          }}
        >
          {t("Databases.Settings.RemoveDup")}
        </Button>

        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            commands
              .deleteEmptyGames(selectedDatabase.file)
              .then(() => {
                setLoading(false);
                reload();
              })
              .catch(() => {
                setLoading(false);
                reload();
              });
          }}
        >
          {t("Databases.Settings.RemoveEmpty")}
        </Button>
      </Group>
    </Stack>
  );
}

function IndexInput({
  indexed,
  file,
  setDatabases,
}: {
  indexed: boolean;
  file: string;
  setDatabases: (dbs: DatabaseInfo[]) => void;
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useToggle();
  return (
    <Group>
      <Tooltip label={t("Databases.Settings.Indexed.Desc")}>
        <Checkbox
          label={t("Databases.Settings.Indexed")}
          disabled={loading}
          checked={indexed}
          onChange={(e) => {
            setLoading(true);
            const fn = e.currentTarget.checked
              ? commands.createIndexes
              : commands.deleteIndexes;
            fn(file).then(() => {
              getDatabases().then((dbs) => {
                setDatabases(dbs);
                setLoading(false);
              });
            });
          }}
        />
      </Tooltip>
      {loading && <Loader size="sm" />}
    </Group>
  );
}
