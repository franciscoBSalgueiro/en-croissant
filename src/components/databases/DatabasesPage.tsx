import { referenceDbAtom, selectedDatabaseAtom } from "@/atoms/atoms";
import { commands } from "@/bindings";
import { DatabaseInfo, getDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { invoke, unwrap } from "@/utils/invoke";
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
import { open as openDialog, save } from "@tauri-apps/api/dialog";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import ConfirmModal from "../common/ConfirmModal";
import GenericCard from "../common/GenericCard";
import OpenFolderButton from "../common/OpenFolderButton";
import AddDatabase from "./AddDatabase";
import ConvertButton from "./ConvertButton";
import { PlayerSearchInput } from "./PlayerSearchInput";

export default function DatabasesPage() {
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
    invoke("clear_games");
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
        title={"Delete Database"}
        description={"Are you sure you want to delete this database?"}
        opened={deleteModal}
        onClose={toggleDeleteModal}
        onConfirm={() => {
          invoke("delete_database", { file: selectedDatabase?.file }).then(
            () => {
              mutate();
              setSelected(null);
            },
          );
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
        <Title>Your Databases</Title>
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
                  error={item.error}
                  onDoubleClick={() => {
                    navigate("/databases/view");
                    setStorageSelected(item);
                  }}
                  Header={
                    <Group wrap="nowrap" justify="space-between">
                      <Group wrap="nowrap" miw={0}>
                        <IconDatabase size="1.5rem" />
                        <Box miw={0}>
                          <Text fw={500}>{item.error ?? item.title}</Text>
                          <Text
                            size="xs"
                            c="dimmed"
                            style={{ wordWrap: "break-word" }}
                          >
                            {item.error ? item.file : item.description}
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
                      label: "Games",
                      value: item.error ? "???" : formatNumber(item.game_count),
                    },
                    {
                      label: "Storage",
                      value: item.error
                        ? "???"
                        : formatBytes(item.storage_size ?? 0),
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
                {selectedDatabase.error ? (
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
                    <Divider variant="dashed" label="General settings" />
                    <GeneralSettings
                      key={selectedDatabase.filename}
                      selectedDatabase={selectedDatabase}
                      mutate={mutate}
                    />
                    <Checkbox
                      label="Reference Database"
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

                    <Divider variant="dashed" label="Data" />
                    <Group grow>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          Games
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.game_count)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          Players
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.player_count)}
                        </Text>
                      </Stack>
                      <Stack gap={0} justify="center" ta="center">
                        <Text size="md" tt="uppercase" fw="bold" c="dimmed">
                          Events
                        </Text>
                        <Text fw={700} size="lg">
                          {formatNumber(selectedDatabase.event_count)}
                        </Text>
                      </Stack>
                    </Group>

                    <div>
                      {!selectedDatabase.error && (
                        <Button
                          component={Link}
                          to="/databases/view"
                          onClick={() => setStorageSelected(selectedDatabase)}
                          fullWidth
                          variant="default"
                          size="lg"
                          rightSection={<IconArrowRight size="1rem" />}
                        >
                          Explore
                        </Button>
                      )}
                    </div>
                  </>
                )}

                <Divider variant="dashed" label="Advanced tools" />

                {!selectedDatabase.error && (
                  <AdvancedSettings
                    selectedDatabase={selectedDatabase}
                    reload={mutate}
                  />
                )}

                <Divider variant="dashed" label="Actions" />
                <Group justify="space-between">
                  {!selectedDatabase.error && (
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
                        Add Games
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
                          await invoke("export_to_pgn", {
                            file: selectedDatabase.file,
                            destFile,
                          });
                          setExportLoading(false);
                        }}
                      >
                        Export to PGN
                      </Button>
                    </Group>
                  )}
                  <Button onClick={() => toggleDeleteModal()} color="red">
                    Delete
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
  selectedDatabase: DatabaseInfo;
  mutate: () => void;
}) {
  const [title, setTitle] = useState(selectedDatabase.title);
  const [description, setDescription] = useState(selectedDatabase.description);

  const [debouncedTitle] = useDebouncedValue(title, 300);
  const [debouncedDescription] = useDebouncedValue(description, 300);

  useEffect(() => {
    invoke("edit_db_info", {
      file: selectedDatabase.file,
      title: debouncedTitle,
      description: debouncedDescription,
    }).then(() => mutate());
  }, [debouncedTitle, debouncedDescription]);

  return (
    <>
      <TextInput
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        error={title === "" && "Name is required"}
      />
      <Textarea
        label="Description"
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
        Merge Players
      </Text>
      <Text fz="sm">
        Replace all occurrences of the first player with the second player in
        the database.
      </Text>
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
          Merge
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
  const [loading, setLoading] = useState(false);
  return (
    <Stack>
      <Text fz="lg" fw="bold">
        Batch Delete
      </Text>
      <Text fz="sm">
        These actions will irreversibly remove games from the database. Use with
        caution.
      </Text>
      <Group>
        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            invoke("delete_duplicated_games", { file: selectedDatabase.file })
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
          Remove Duplicates
        </Button>

        <Button
          loading={loading}
          onClick={async () => {
            setLoading(true);
            invoke("delete_empty_games", { file: selectedDatabase.file })
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
          Remove Empty Games
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
  const [loading, setLoading] = useToggle();
  return (
    <Group>
      <Tooltip label="Indexes are used to speed up the search process, but they take up extra space.">
        <Checkbox
          label="Indexed"
          disabled={loading}
          checked={indexed}
          onChange={(e) => {
            setLoading(true);
            invoke(
              e.currentTarget.checked ? "create_indexes" : "delete_indexes",
              {
                file,
              },
            ).then(() => {
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
