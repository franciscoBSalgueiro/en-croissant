import { Card, createStyles, Loader, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons";
import { invoke } from "@tauri-apps/api";
import { open } from "@tauri-apps/api/dialog";
import { useEffect, useState } from "react";

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
    width: 150,
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

function ConvertButton() {
  const [filepath, setFilepath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { classes } = useStyles();

  async function convert(filepath: string) {
    setLoading(true);
    await invoke("convert_pgn", { file: filepath });
    setLoading(false);
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
      // accept="application/octet-stream"
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
