import { Card, createStyles, Loader, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import { open } from "@tauri-apps/api/dialog";
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

function ConvertButton({
  setDatabases,
}: {
  setDatabases: (dbs: Database[]) => void;
}) {
  const [filepath, setFilepath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { classes } = useStyles();

  async function convert(filepath: string) {
    setLoading(true);
    await invoke("convert_pgn", { file: filepath, fromLichess: false });
    setLoading(false);
    setDatabases(await getDatabases());
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
      <Text weight={500}>Add New</Text>
      {loading ? <Loader size={30} /> : <IconPlus size={30} />}
    </Card>
  );
}

export default ConvertButton;
