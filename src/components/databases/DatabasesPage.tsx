import {
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import {
  useDebouncedValue,
  useLocalStorage,
  useSessionStorage,
  useToggle,
} from "@mantine/hooks";
import { IconDatabase, IconStar } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DatabaseInfo, getDatabases } from "../../utils/db";
import { formatBytes, formatNumber } from "../../utils/format";
import { invoke } from "../../utils/misc";
import GenericCard from "../common/GenericCard";
import OpenFolderButton from "../common/OpenFolderButton";
import AddDatabase from "./AddDatabase";
import ConvertButton from "./ConvertButton";

export default function DatabasesPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] =
    useSessionStorage<DatabaseInfo | null>({
      key: "database-view",
      defaultValue: null,
    });
  const [referenceDatabase, setReferenceDatabase] = useLocalStorage<
    string | null
  >({
    key: "reference-database",
    defaultValue: null,
  });
  const isReference = referenceDatabase === selectedDatabase?.file;

  const database = selected !== null ? databases[selected] : null;

  const [title, setTitle] = useState(database?.title ?? null);
  const [debouncedTitle] = useDebouncedValue(title, 100);
  const [description, setDescription] = useState(database?.description ?? null);
  const [debouncedDescription] = useDebouncedValue(description, 100);
  const [deleteModal, toggleDeleteModal] = useToggle();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  useEffect(() => {
    if ((debouncedTitle || debouncedDescription) && database !== null) {
      invoke("edit_db_info", {
        file: database.file,
        title: debouncedTitle,
        description: debouncedDescription,
      }).then(() => {
        getDatabases().then((dbs) => setDatabases(dbs));
      });
    }
  }, [debouncedTitle, debouncedDescription]);

  useEffect(() => {
    setTitle(database?.title ?? null);
  }, [database]);

  useEffect(() => {
    setDescription(database?.description ?? null);
  }, [database]);

  useEffect(() => {
    setSelectedDatabase(database);
  }, [database, setSelectedDatabase]);

  return (
    <>
      <Modal
        withCloseButton={false}
        opened={deleteModal}
        onClose={toggleDeleteModal}
      >
        <Stack>
          <div>
            <Text fz="lg" fw="bold" mb={10}>
              Delete Database
            </Text>
            <Text>Are you sure you want to delete this database?</Text>
            <Text>This action cannot be undone.</Text>
          </div>

          <Group position="right">
            <Button variant="default" onClick={() => toggleDeleteModal()}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                invoke("delete_database", { file: database!.file }).then(() => {
                  getDatabases().then((dbs) => {
                    setDatabases(dbs);
                    setSelected(null);
                  });
                });
                toggleDeleteModal();
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <AddDatabase
        databases={databases}
        opened={open}
        setOpened={setOpen}
        setLoading={setLoading}
        setDatabases={setDatabases}
      />

      <Group align="baseline" m="lg" mt="xl">
        <Title>Your Databases</Title>
        <OpenFolderButton folder="db" />
      </Group>
      <SimpleGrid
        cols={4}
        breakpoints={[
          { maxWidth: 1200, cols: 3, spacing: "md" },
          { maxWidth: 1000, cols: 2, spacing: "sm" },
          { maxWidth: 800, cols: 1, spacing: "sm" },
        ]}
      >
        {databases.map((item, i) => (
          <GenericCard
            id={i}
            key={item.filename}
            isSelected={selected === i}
            setSelected={setSelected}
            error={item.error}
            Header={
              <Group noWrap position="apart">
                <Group noWrap>
                  <IconDatabase size={24} />
                  <div>
                    <Text weight={500}>{item.error ?? item.title}</Text>
                    <Text size="xs" color="dimmed">
                      {item.error ? item.file : item.description}
                    </Text>
                  </div>
                </Group>
                {referenceDatabase === item.file && <IconStar size={16} />}
              </Group>
            }
            stats={[
              {
                label: "Games",
                value: item.error ? "???" : formatNumber(item.game_count),
              },
              {
                label: "Storage",
                value: item.error ? "???" : formatBytes(item.storage_size),
              },
            ]}
          />
        ))}
        <ConvertButton setOpen={setOpen} loading={loading} />
      </SimpleGrid>

      {database !== null && (
        <Box mx={30}>
          <Divider my="md" />
          <Stack>
            {database.error ? (
              <>
                <Text fz="lg" fw="bold">
                  There was an error loading this database
                </Text>

                <Text>
                  <Text underline span>
                    Reason:
                  </Text>
                  {" " + database.error}
                </Text>

                <Text>
                  Check if the file exists and that it is not corrupted.
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  label="Title"
                  value={title ?? ""}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                  error={title === "" && "Name is required"}
                />
                <Textarea
                  label="Description"
                  value={description ?? ""}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                />
                <Checkbox
                  label="Reference Database"
                  checked={isReference}
                  onChange={() => {
                    if (isReference) {
                      setReferenceDatabase(null);
                      invoke("clear_games");
                    } else {
                      if (database.file !== referenceDatabase) {
                        invoke("clear_games");
                      }
                      setReferenceDatabase(database.file);
                    }
                  }}
                />
              </>
            )}
            <Group>
              {!database.error && (
                <Link href={`/db/view`}>
                  <Button>Explore</Button>
                </Link>
              )}
              <Button onClick={() => toggleDeleteModal()} color="red">
                Delete
              </Button>
            </Group>
          </Stack>
        </Box>
      )}
    </>
  );
}
