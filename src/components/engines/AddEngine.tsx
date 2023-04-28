import {
  Alert,
  Button,
  Card,
  createStyles,
  Group,
  Modal,
  NumberInput,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useOs } from "@mantine/hooks";
import { IconAlertCircle, IconDatabase, IconTrophy } from "@tabler/icons-react";
import { open } from "@tauri-apps/api/dialog";
import { appDataDir, join, resolve } from "@tauri-apps/api/path";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Engine, getDefaultEngines } from "../../utils/engines";
import { formatBytes } from "../../utils/format";
import { invoke } from "../../utils/misc";
import FileInput from "../common/FileInput";
import { ProgressButton } from "../common/ProgressButton";

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  title: {
    fontWeight: 700,
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    lineHeight: 1.2,
  },

  body: {
    padding: theme.spacing.md,
  },
}));

function AddEngine({
  engines,
  opened,
  setOpened,
  setEngines,
}: {
  engines: Engine[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setEngines: Dispatch<SetStateAction<Engine[]>>;
}) {
  const os = useOs();

  let filters: {
    name: string;
    extensions: string[];
  }[] = [];
  if (os == "windows") {
    filters = [{ name: "Executable Files", extensions: ["exe"] }];
  }

  const [defaultEngines, setDefaultEngines] = useState<Engine[]>([]);
  const [error, setError] = useState<boolean>(false);
  const form = useForm<Engine>({
    initialValues: {
      version: "",
      name: "",
      path: "",
      image: "",
      elo: null,
    },

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (engines.find((e) => e.name === value)) return "Name already used";
      },
      path: (value) => {
        if (!value) return "Path is required";
      },
    },
  });

  useEffect(() => {
    if (os === "undetermined") return;
    getDefaultEngines(os)
      .then((engines) => {
        setDefaultEngines(engines);
      })
      .catch(() => {
        setError(true);
      });
  }, [os]);

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Add Engine">
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">Web</Tabs.Tab>
          <Tabs.Tab value="local">Local</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          <Stack>
            {defaultEngines.map((engine, i) => (
              <EngineCard
                engine={engine}
                engineId={i}
                key={i}
                setEngines={setEngines}
                initInstalled={engines.some((e) => e.name === engine.name)}
              />
            ))}
            {error && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Error"
                color="red"
              >
                Failed to fetch the engine's info from the server.
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              setEngines((prev) => [...prev, values]);
              setOpened(false);
            })}
          >
            <FileInput
              label="Binary file"
              description="Click to select the binary file"
              filename={form.values.path}
              withAsterisk
              onClick={async () => {
                const selected = await open({
                  multiple: false,
                  filters,
                });
                if (!selected) return;
                const name: string = await invoke("get_engine_name", {
                  path: selected as string,
                });
                form.setFieldValue("path", selected as string);
                form.setFieldValue("name", name);
              }}
            />

            <TextInput
              label="Name"
              placeholder="Auto"
              withAsterisk
              {...form.getInputProps("name")}
            />

            <NumberInput
              label="Elo"
              placeholder="Engine's Elo"
              {...form.getInputProps("elo")}
            />

            {/* <Input.Wrapper
              label="Image file"
              description="Click to select the image file"
              {...form.getInputProps("image")}
            >
              <Input
                component="button"
                type="button"
                // accept="application/octet-stream"
                onClick={async () => {
                  const selected = await open({
                    multiple: false,
                    filters: [
                      {
                        name: "Image",
                        extensions: ["png", "jpeg"],
                      },
                    ],
                  });
                  form.setFieldValue("image", selected as string);
                }}
              >
                <Text lineClamp={1}>{form.values.image}</Text>
              </Input>
            </Input.Wrapper> */}

            <Button fullWidth mt="xl" type="submit">
              Add
            </Button>
          </form>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function EngineCard({
  setEngines,
  engine,
  engineId,
  initInstalled,
}: {
  setEngines: Dispatch<SetStateAction<Engine[]>>;
  engine: Engine;
  engineId: number;
  initInstalled: boolean;
}) {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const downloadEngine = useCallback(async (id: number, url: string) => {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "engines");
    await invoke("download_file", {
      id,
      url,
      zip: true,
      path,
    });
    let appDataDirPath = await appDataDir();
    if (appDataDirPath.endsWith("/") || appDataDirPath.endsWith("\\")) {
      appDataDirPath = appDataDirPath.slice(0, -1);
    }
    const enginePath = await join(
      appDataDirPath,
      "engines",
      ...engine.path.split("/")
    );
    await invoke("set_file_as_executable", { path: enginePath });
    setEngines((prev) => [
      ...prev,
      {
        ...engine,
        path: enginePath,
      },
    ]);
  }, []);

  const { classes } = useStyles();

  return (
    <Card
      withBorder
      radius="md"
      p={0}
      key={engine.name}
      className={classes.card}
    >
      <Group noWrap spacing={0} grow>
        {engine.image && (
          <img src={engine.image} height={160} alt={engine.name} />
        )}
        <div className={classes.body}>
          <Text transform="uppercase" color="dimmed" weight={700} size="xs">
            ENGINE
          </Text>
          <Text className={classes.title} mb="xs">
            {engine.name} {engine.version}
          </Text>
          <Group noWrap spacing="xs">
            <IconTrophy size={16} />
            <Text size="xs">{`${engine.elo} ELO`}</Text>
          </Group>
          <Group noWrap spacing="xs" mb="xs">
            <IconDatabase size={16} />
            <Text size="xs">{formatBytes(engine.downloadSize!)}</Text>
          </Group>
          <ProgressButton
            id={engineId}
            progressEvent="download_progress"
            initInstalled={initInstalled}
            labels={{
              completed: "Installed",
              action: "Install",
              inProgress: "Downloading",
              finalizing: "Extracting",
            }}
            onClick={() => downloadEngine(engineId, engine.downloadLink!)}
            inProgress={inProgress}
            setInProgress={setInProgress}
          />
        </div>
      </Group>
    </Card>
  );
}

export default AddEngine;
