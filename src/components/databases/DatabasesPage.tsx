import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useToggle } from "@mantine/hooks";
import { IconDatabase, IconStar } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { DatabaseInfo, getDatabases } from "@/utils/db";
import { formatBytes, formatNumber } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import GenericCard from "../common/GenericCard";
import OpenFolderButton from "../common/OpenFolderButton";
import AddDatabase from "./AddDatabase";
import ConvertButton from "./ConvertButton";
import { useAtom } from "jotai";
import { referenceDbAtom, selectedDatabaseAtom } from "@/atoms/atoms";
import ConfirmModal from "../common/ConfirmModal";

export default function DatabasesPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const db = sessionStorage.getItem("database-view");
    if (db !== null && db !== "null") {
      navigate("/databases/view/");
    }
  }, [navigate]);

  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useAtom(selectedDatabaseAtom);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const isReference = referenceDatabase === selectedDatabase?.file;

  const [title, setTitle] = useState(selectedDatabase?.title ?? null);
  const [debouncedTitle] = useDebouncedValue(title, 100);
  const [description, setDescription] = useState(
    selectedDatabase?.description ?? null
  );
  const [debouncedDescription] = useDebouncedValue(description, 100);
  const [deleteModal, toggleDeleteModal] = useToggle();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  useEffect(() => {
    if ((debouncedTitle || debouncedDescription) && selectedDatabase !== null) {
      invoke("edit_db_info", {
        file: selectedDatabase.file,
        title: debouncedTitle,
        description: debouncedDescription,
      }).then(() => {
        getDatabases().then((dbs) => setDatabases(dbs));
      });
    }
  }, [debouncedTitle, debouncedDescription]);

  useEffect(() => {
    setTitle(selectedDatabase?.title ?? null);
  }, [selectedDatabase]);

  useEffect(() => {
    setDescription(selectedDatabase?.description ?? null);
  }, [selectedDatabase]);

  return (
    <>
      <ConfirmModal
        title={"Delete Database"}
        description={"Are you sure you want to delete this database?"}
        opened={deleteModal}
        onClose={toggleDeleteModal}
        onConfirm={() => {
          invoke("delete_database", { file: selectedDatabase!.file }).then(
            () => {
              getDatabases().then((dbs) => {
                setDatabases(dbs);
                setSelectedDatabase(null);
              });
            }
          );
          toggleDeleteModal();
        }}
      />

      <AddDatabase
        databases={databases}
        opened={open}
        setOpened={setOpen}
        setLoading={setLoading}
        setDatabases={setDatabases}
      />

      <Group align="baseline" pl="lg" py="sm">
        <Title>Your Databases</Title>
        <OpenFolderButton base="AppDir" folder="db" />
      </Group>
      <SimpleGrid
        cols={4}
        breakpoints={[
          { maxWidth: 1200, cols: 3, spacing: "md" },
          { maxWidth: 1000, cols: 2, spacing: "sm" },
          { maxWidth: 800, cols: 1, spacing: "sm" },
        ]}
      >
        {databases.map((item) => (
          <GenericCard
            id={item}
            key={item.filename}
            isSelected={selectedDatabase?.filename === item.filename}
            setSelected={setSelectedDatabase}
            error={item.error}
            Header={
              <Group noWrap position="apart">
                <Group noWrap>
                  <IconDatabase size="1.5rem" />
                  <div>
                    <Text weight={500}>{item.error ?? item.title}</Text>
                    <Text size="xs" color="dimmed">
                      {item.error ? item.file : item.description}
                    </Text>
                  </div>
                </Group>
                {referenceDatabase === item.file && <IconStar size="1rem" />}
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

      {selectedDatabase !== null && (
        <Box mx={30}>
          <Divider my="md" />
          <Stack>
            {selectedDatabase.error ? (
              <>
                <Text fz="lg" fw="bold">
                  There was an error loading this database
                </Text>

                <Text>
                  <Text underline span>
                    Reason:
                  </Text>
                  {" " + selectedDatabase.error}
                </Text>

                <Text>
                  Check if the file exists and that it is not corrupted.
                </Text>
              </>
            ) : (
              <>
                <Group>
                  {selectedDatabase.indexed && <Badge>Indexed</Badge>}
                  {isReference && <Badge>Reference</Badge>}
                </Group>
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
                      if (selectedDatabase.file !== referenceDatabase) {
                        invoke("clear_games");
                      }
                      setReferenceDatabase(selectedDatabase.file);
                    }
                  }}
                />
              </>
            )}
            <Group>
              {!selectedDatabase.error && (
                <>
                  <Link to={`/databases/view`}>
                    <Button>Explore</Button>
                  </Link>
                  <IndexButton
                    indexed={selectedDatabase.indexed}
                    file={selectedDatabase.file}
                    setDatabases={setDatabases}
                  />
                </>
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

function IndexButton({
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
    <Tooltip label="Indexes are used to speed up the search process, but they take up extra space.">
      {indexed ? (
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true);
            invoke("delete_indexes", {
              file,
            }).then(() => {
              getDatabases().then((dbs) => {
                setDatabases(dbs);
                setLoading(false);
              });
            });
          }}
          color="red"
        >
          Delete Indexes
        </Button>
      ) : (
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true);
            invoke("create_indexes", {
              file,
            }).then(() => {
              getDatabases().then((dbs) => {
                setDatabases(dbs);
                setLoading(false);
              });
            });
          }}
        >
          Create Indexes
        </Button>
      )}
    </Tooltip>
  );
}
