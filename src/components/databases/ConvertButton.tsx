import { Box, Card, createStyles, Loader, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons";
import { open } from "@tauri-apps/api/dialog";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/api/shell";
import { useEffect, useState } from "react";
import { Database, getDatabases } from "../../utils/db";

const useStyles = createStyles((theme) => ({
  card: {
    cursor: "pointer",
    border: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[6]
          : theme.colors.gray[0],
    },
  },
}));

type Progress = {
  total: number;
  speed: number;
};

function ConvertButton({
  setDatabases,
}: {
  setDatabases: (dbs: Database[]) => void;
}) {
  const [filepath, setFilepath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { classes } = useStyles();
  const [progress, setProgress] = useState<Progress | null>(null);

  async function convertDB(path: string) {
    let fileName = path.split(/(\\|\/)/g).pop();
    fileName = fileName?.replace(".pgn", ".ocgdb.db3");
    const output_path = await resolve(await appDataDir(), "db", fileName!);
    const command = Command.sidecar("binaries/ocgdb", [
      "-create",
      "-pgn",
      path,
      "-db",
      output_path,
      "-o",
      "moves2",
    ]);
    command.stdout.on("data", (data) => {
      const match = data
        .toString()
        .match(
          /#games: (\d+), elapsed: (\d+)ms (\d+:\d+), speed: (\d+) games\/s/
        );
      if (match) {
        const total = parseInt(match[1]);
        const speed = parseInt(match[4]);
        setProgress({ total, speed });
      } else if (data.toString().includes("Completed")) {
        setProgress(null);
        setLoading(false);
      }
    });
    command.on("close", () => {
      getDatabases().then((dbs) => setDatabases(dbs));
    });
    await command.spawn();
  }

  async function convert(filepath: string) {
    setLoading(true);
    await convertDB(filepath);
  }

  useEffect(() => {
    if (filepath) {
      convert(filepath);
    }
  }, [filepath]);

  return (
    <Card
      withBorder
      radius="md"
      className={classes.card}
      component="button"
      type="button"
      onClick={async () => {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "PGN file",
              extensions: ["pgn", "pgn.zst"],
            },
          ],
        });
        setFilepath(selected as string);
      }}
    >
      <Text weight={500} mb={10}>
        Add New
      </Text>
      {loading ? <Loader variant="dots" size={30} /> : <IconPlus size={30} />}

      {progress && (
        <Box sx={{ display: "flex", justifyContent: "space-around" }}>
          <Text fz="xs">{progress.total} games</Text>
          <Text fz="xs" mb={10}>
            {progress.speed} games/s
          </Text>
        </Box>
      )}
    </Card>
  );
}

export default ConvertButton;
