import { Card, createStyles, Group, Text, Title } from "@mantine/core";
import { IconDatabase } from "@tabler/icons";
import dynamic from "next/dynamic";
import { useState } from "react";

const ConvertButton = dynamic(() => import("../components/ConvertButton"), {
  ssr: false,
});

const GameTable = dynamic(() => import("../components/GameTable"), {
  ssr: false,
});

const useStyles = createStyles((theme) => ({
  input: {
    position: "fixed",
    opacity: 0,

    "&:checked + label": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],

      borderColor: theme.colors.blue[6],
    },
  },

  card: {
    cursor: "pointer",
    width: 300,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],
    },

    "&:checked": {
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
}));

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface CollectionCardProps {
  id: number;
  setSelected: (selected: number) => void;
  title: string;
  description?: string;
  games: number;
  storage: number;
}

function CollectionCard({
  id,
  setSelected,
  title,
  description,
  games,
  storage,
}: CollectionCardProps) {
  const { classes } = useStyles();

  return (
    <>
      <input
        type="radio"
        id={title}
        name="selected-database"
        className={classes.input}
      />
      <Card
        component="label"
        htmlFor={title}
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

const data = [
  {
    title: "Masters Database",
    description: "The largest chess database in the world.",
    games: 1700423,
    storage: 1000000000,
  },
  {
    title: "Lichess Database",
    description: "Every game played on Lichess.org.",
    games: 20000423,
    storage: 2000000000,
  },
];

export default function Page() {
  const [selected, setSelected] = useState<number | null>(null);
  const database = selected !== null ? data[selected] : null;

  return (
    <>
      <Title m={30}>Your Collections</Title>
      <Group>
        {data.map((item, i) => (
          <CollectionCard
            id={i}
            key={item.title}
            setSelected={setSelected}
            title={item.title}
            description={item.description}
            games={item.games}
            storage={item.storage}
          />
        ))}
        <ConvertButton />
      </Group>

      <Title m={30}>Your Database</Title>

      <Text>{database?.title}</Text>
      <GameTable file="C:\Users\Francisco\AppData\Roaming\en-croissant\db\lichess_db_standard_rated_2013-01.sqlite" />
    </>
  );
}
