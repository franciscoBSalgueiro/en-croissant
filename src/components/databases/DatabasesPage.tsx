import {
  Box,
  Button,
  Card,
  Checkbox,
  createStyles,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from "@mantine/core";
import { useDebouncedValue, useLocalStorage, useSessionStorage } from "@mantine/hooks";
import { IconDatabase, IconStar } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, getDatabases } from "../../utils/db";
import { formatBytes, formatNumber } from "../../utils/format";
import OpenFolderButton from "../common/OpenFolderButton";
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

interface CollectionCardProps {
  id: number;
  selected: boolean;
  setSelected: (selected: number) => void;
  title: string;
  description?: string;
  games: number;
  storage: number;
  isReference: boolean;
}

function CollectionCard({
  id,
  selected,
  setSelected,
  title,
  description,
  games,
  storage,
  isReference,
}: CollectionCardProps) {
  const { classes } = useStyles({ selected });

  return (
    <>
      <Card
        withBorder
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
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDatabse, setSelectedDatabase] =
    useSessionStorage<Database | null>({
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
  const [debouncedTitle] = useDebouncedValue(title, 200);

  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  useEffect(() => {
    if (debouncedTitle !== null && database !== null && debouncedTitle !== "") {
      invoke("rename_db", {
        file: database.file,
        title: debouncedTitle,
      }).then(() => {
        getDatabases().then((dbs) => setDatabases(dbs));
      });
    }
  }, [debouncedTitle]);

  useEffect(() => {
    setTitle(database?.title ?? null);
  }, [database?.file]);

  useEffect(() => {
    setSelectedDatabase(database);
  }, [database?.file]);

  return (
    <>
      <Group align="baseline" m={30}>
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
          <CollectionCard
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
        <ConvertButton setDatabases={setDatabases} />
      </SimpleGrid>

      {database !== null && title !== null && (
        <Box mx={30}>
          <Divider my="md" />
          <Stack>
            <TextInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              error={title === "" && "Name is required"}
            />
            <Textarea label="Description" value={database.description} />
            <Checkbox
              label="Reference Database"
              checked={isReference}
              onChange={() => {
                if (isReference) {
                  setReferenceDatabase(null);
                } else {
                  setReferenceDatabase(database.file);
                }
              }}
            />
            <Link href={`/db/view`}>
              <Button>Explore</Button>
            </Link>
          </Stack>
        </Box>
      )}
    </>
  );
}
