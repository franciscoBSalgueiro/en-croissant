import {
  Card,
  createStyles,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title
} from "@mantine/core";
import { IconDatabase } from "@tabler/icons";
import { useEffect, useState } from "react";
import { Database, formatBytes, getDatabases } from "../utils/db";
import ConvertButton from "./ConvertButton";
import GameTable from "./GameTable";
import OpenFolderButton from "./OpenFolderButton";

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

      borderColor: selected ? theme.colors.blue[6] : "transparent",
      borderWidth: 2,

      "&:hover": {
        backgroundColor:
          theme.colorScheme === "dark"
            ? theme.colors.dark[6]
            : theme.colors.gray[0],
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
}

function CollectionCard({
  id,
  selected,
  setSelected,
  title,
  description,
  games,
  storage,
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
          <Group noWrap>
            <IconDatabase size={24} />
            <div>
              <Text weight={500}>{title}</Text>
              <Text size="xs" color="dimmed">
                {description}
              </Text>
            </div>
          </Group>

          <div className={classes.info}>
            <div>
              <Text size="sm" color="dimmed" className={classes.label} mt={15}>
                Games
              </Text>
              <Text weight={700} size="xl" sx={{ lineHeight: 1 }}>
                {Intl.NumberFormat().format(games)}
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

export default function DatabasesTable() {
  const [selected, setSelected] = useState<number | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const database = selected !== null ? databases[selected] : null;

  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

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
          />
        ))}
        <ConvertButton setDatabases={setDatabases} />
      </SimpleGrid>

      {database !== null && <GameTable database={database} />}
    </>
  );
}
