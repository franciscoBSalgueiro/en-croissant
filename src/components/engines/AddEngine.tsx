import {
  Button,
  Card,
  createStyles,
  Group,
  Input,
  Modal,
  Stack,
  Tabs,
  Text,
  TextInput
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useOs } from "@mantine/hooks";
import { IconDatabase, IconTrophy } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api";
import { open } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { appDataDir } from "@tauri-apps/api/path";
import { resolve } from "path";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Engine, EngineSettings, getDefaultEngines } from "../../utils/engines";
import { formatBytes } from "../../utils/format";
import { ProgressButton } from "./ProgressButton";

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
  setEngineSettings,
}: {
  engines: Engine[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setEngineSettings: Dispatch<SetStateAction<EngineSettings[]>>;
}) {
  const os = useOs();
  const [defaultEngines, setDefaultEngines] = useState<Engine[]>([]);
  const form = useForm<EngineSettings>({
    initialValues: {
      name: "",
      binary: "",
      image: "",
      elo: null,
    },

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if (engines.find((e) => e.name === value)) return "Name already used";
      },
      binary: (value) => {
        if (!value) return "Binary is required";
      },
    },
  });

  useEffect(() => {
    if (os === "undetermined") return;
    getDefaultEngines(os).then((engines) => {
      setDefaultEngines(engines);
    });
  }, [os]);

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Install Engine"
    >
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
                setEngineSettings={setEngineSettings}
                initInstalled={engines.some((e) => e.name === engine.name)}
              />
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              setEngineSettings((prev) => [...prev, values]);
              setOpened(false);
            })}
          >
            <TextInput
              label="Name"
              placeholder="Engine's Name"
              withAsterisk
              {...form.getInputProps("name")}
            />

            <Input.Wrapper
              label="Binary file"
              description="Click to select the binary file"
              withAsterisk
              {...form.getInputProps("binary")}
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
                        name: "Binary",
                        extensions: ["exe", "bin", "sh"],
                      },
                    ],
                  });
                  form.setFieldValue("binary", selected as string);
                }}
              >
                <Text lineClamp={1}>{form.values.binary}</Text>
              </Input>
            </Input.Wrapper>

            <Input.Wrapper
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
            </Input.Wrapper>

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
  setEngineSettings,
  engine,
  engineId,
  initInstalled,
}: {
  setEngineSettings: Dispatch<SetStateAction<EngineSettings[]>>;
  engine: Engine;
  engineId: number;
  initInstalled: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [inProgress, setInProgress] = useState(false);
  const [installed, setInstalled] = useState(initInstalled);

  async function downloadEngine(id: number, url: string) {
    setInProgress(true);
    await invoke("download_file", {
      id,
      url,
      zip: true,
      path: (await appDataDir()) + "engines",
    });
    setInProgress(false);
  }

  useEffect(() => {
    async function getEngineProgress() {
      const unlisten = await listen("download_progress", async (event) => {
        const { progress, id, finished } = event.payload as any;
        if (id !== engineId) return;
        if (finished) {
          setInstalled(true);
          const appDataDirPath = await appDataDir();
          const enginePath = await resolve(appDataDirPath, engine.path);
          setEngineSettings((prev) => {
            if (prev.find((e) => e.name === engine.name)) return prev;
            return [
              ...prev,
              {
                binary: enginePath,
                name: engine.name,
                image: engine.image,
                elo: engine.elo || null,
              },
            ];
          });
          unlisten();
        } else {
          setProgress(progress);
        }
      });
    }
    getEngineProgress();
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
        <img src={engine.image} height={160} alt={engine.name} />
        <div className={classes.body}>
          <Text transform="uppercase" color="dimmed" weight={700} size="xs">
            ENGINE
          </Text>
          <Text className={classes.title} mb="xs">
            {engine.name}
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
            loaded={installed}
            onClick={() => downloadEngine(engineId, engine.downloadLink!)}
            progress={progress}
            id={engineId}
            disabled={installed || inProgress}
          />
        </div>
      </Group>
    </Card>
  );
}

export default AddEngine;
