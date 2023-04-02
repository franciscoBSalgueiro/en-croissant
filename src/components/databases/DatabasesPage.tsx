import {
  Box,
  Button,
  Card,
  Checkbox,
  createStyles,
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
import { invoke } from "@tauri-apps/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DatabaseInfo, getDatabases } from "../../utils/db";
import { formatBytes, formatNumber } from "../../utils/format";
import OpenFolderButton from "../common/OpenFolderButton";
import AddDatabase from "./AddDatabase";
import ConvertButton from "./ConvertButton";

const useStyles = createStyles(
  (theme, { selected }: { selected: boolean }) => ({
    card: {
      cursor: "pointer",
      backgroundColor: selected
        ? theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0]
        : theme.colorScheme === "dark"
        ? theme.colors.dark[7]
        : theme.white,

      borderStyle: "solid",
      borderColor: selected
        ? theme.colors[theme.primaryColor][6]
        : "transparent",
      borderWidth: 2,

      "&:hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[0],
        borderColor: selected
          ? theme.colors[theme.primaryColor][6]
          : theme.colors.gray[6],
      },
    },

    label: {
      marginBottom: theme.spacing.xs,
      lineHeight: 1,
      fontWeight: 700,
      fontSize: theme.fontSizes.xs,
      letterSpacing: -0.25,
      textTransform: "uppercase",
    },

    info: {
      display: "flex",
      justifyContent: "space-between",
    },
  })
);

interface DatabaseCardProps {
  id: number;
  selected: boolean;
  setSelected: (selected: number) => void;
  title: string;
  description?: string;
  games: number;
  storage: number;
  isReference: boolean;
}

function DatabaseCard({
  id,
  selected,
  setSelected,
  title,
  description,
  games,
  storage,
  isReference,
}: DatabaseCardProps) {
  const { classes } = useStyles({ selected });

  return (
    <>
      <Card
        radius="md"
        className={classes.card}
        onClick={() => setSelected(id)}
      >
        <Stack>
          <Group noWrap position="apart">
            <Group noWrap>
              <IconDatabase size={24} />
              <div>
                <Text weight={500}>{title}</Text>
                <Text size="xs" color="dimmed">
                  {description}
                </Text>
              </div>
            </Group>
            {isReference && <IconStar size={16} />}
          </Group>

          <div className={classes.info}>
            <div>
              <Text size="sm" color="dimmed" className={classes.label} mt={15}>
                Games
              </Text>
              <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                {formatNumber(games)}
              </Text>
            </div>
            <div>
              <Text size="sm" color="dimmed" className={classes.label} mt={15}>
                Storage
              </Text>
              <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                {formatBytes(storage)}
              </Text>
            </div>
          </div>
        </Stack>
      </Card>
    </>
  );
}

export default function DatabasesPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedDatabse, setSelectedDatabase] =
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
  const isReference = referenceDatabase === selectedDatabse?.file;

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
      })
        .then(() => {
          getDatabases().then((dbs) => setDatabases(dbs));
        })
        .catch((e) => {
          console.log(e);
        });
    }
  }, [debouncedTitle, debouncedDescription]);

  useEffect(() => {
    setTitle(database?.title ?? null);
  }, [database?.file]);

  useEffect(() => {
    setDescription(database?.description ?? null);
  }, [database?.file]);

  useEffect(() => {
    setSelectedDatabase(database);
  }, [database?.file]);

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
          <DatabaseCard
            id={i}
            selected={selected === i}
            key={item.file}
            setSelected={setSelected}
            title={item.title ?? "Untitled"}
            description={item.description}
            games={item.game_count ?? -1}
            storage={item.storage_size ?? 0}
            isReference={referenceDatabase === item.file}
          />
        ))}
        <ConvertButton setOpen={setOpen} loading={loading} />
      </SimpleGrid>

      {database !== null && (
        <Box mx={30}>
          <Divider my="md" />
          <Stack>
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
            <Group>
              <Link href={`/db/view`}>
                <Button>Explore</Button>
              </Link>
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
