import { Card, createStyles, Group, Text, Title } from "@mantine/core";
import { IconDatabase } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import { appDataDir } from "@tauri-apps/api/path";
import { DEFAULT_POSITION } from "chess.js";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Database, formatBytes } from "../utils/db";
import BoardView from "./BoardView";

const ConvertButton = dynamic(() => import("../components/ConvertButton"), {
  ssr: false,
});

const OpenFolderButton = dynamic(
  () => import("../components/OpenFolderButton"),
  {
    ssr: false,
  }
);

const GameTable = dynamic(() => import("../components/GameTable"), {
  ssr: false,
});

const useStyles = createStyles(
  (theme, { selected }: { selected: boolean }) => ({
    card: {
      cursor: "pointer",
      width: 300,
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
        <Group>
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
      </Card>
    </>
  );
}

export default function DatabasesTable() {
  const [selected, setSelected] = useState<number | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const database = selected !== null ? databases[selected] : null;

  useEffect(() => {
    async function getDatabases() {
      let base_path = await appDataDir();
      let files: string[] = await invoke("readDir", {
        path: base_path + "/db",
      });
      let dbs = files.filter((file) => file.endsWith(".sqlite"));
      let db_data: Database[] = [];
      for (let db of dbs) {
        let data = (await invoke("getDatabaseInfo", {
          file: db,
        })) as Database;
        data.file = db;
        db_data.push(data as Database);
      }
      setDatabases(db_data);
    }
    getDatabases();
  }, []);

  return (
    <>
      <Group align="baseline" m={30}>
        <Title>Your Databases</Title>
        <OpenFolderButton path="db" />
      </Group>
      <Group>
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
        <ConvertButton />
      </Group>

      <Title m={30}>Games</Title>

      {database !== null && <GameTable database={database} />}
      <BoardView fen={DEFAULT_POSITION} />
    </>
  );
}
