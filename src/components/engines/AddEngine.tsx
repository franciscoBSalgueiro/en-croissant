import {
  Alert,
  Card,
  Center,
  createStyles,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconDatabase, IconTrophy } from "@tabler/icons-react";
import { platform } from "@tauri-apps/api/os";
import { appDataDir, join, resolve } from "@tauri-apps/api/path";
import { useCallback, useState } from "react";
import { Engine, useDefaultEngines } from "@/utils/engines";
import { formatBytes } from "@/utils/format";
import { invoke } from "@/utils/invoke";
import ProgressButton from "../common/ProgressButton";
import useSWR from "swr";
import { match } from "ts-pattern";
import EngineForm from "./EngineForm";
import { useAtom } from "jotai";
import { enginesAtom } from "@/atoms/atoms";

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
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const [engines, setEngines] = useAtom(enginesAtom);
  const { data: os } = useSWR("os", async () => {
    const p = await platform();
    const os = match(p)
      .with("win32", () => "windows" as const)
      .with("linux", () => "linux" as const)
      .with("darwin", () => "macos" as const)
      .otherwise(() => {
        throw Error("OS not supported");
      });
    return os;
  });

  const { defaultEngines, error, isLoading } = useDefaultEngines(os, opened);

  const form = useForm<Engine>({
    initialValues: {
      version: "",
      name: "",
      path: "",
      image: "",
      elo: "",
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

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Add Engine">
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">Web</Tabs.Tab>
          <Tabs.Tab value="local">Local</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize mah={500} offsetScrollbars>
            <Stack>
              {defaultEngines &&
                defaultEngines.map((engine, i) => (
                  <EngineCard
                    engine={engine}
                    engineId={i}
                    key={i}
                    initInstalled={engines.some((e) => e.name === engine.name)}
                  />
                ))}
              {error && (
                <Alert
                  icon={<IconAlertCircle size="1rem" />}
                  title="Error"
                  color="red"
                >
                  {"Failed to fetch the engine's info from the server."}
                </Alert>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <EngineForm
            submitLabel="Add"
            form={form}
            onSubmit={(values: Engine) => {
              setEngines(async (prev) => [...(await prev), values]);
              setOpened(false);
            }}
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function EngineCard({
  engine,
  engineId,
  initInstalled,
}: {
  engine: Engine;
  engineId: number;
  initInstalled: boolean;
}) {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [, setEngines] = useAtom(enginesAtom);
  const downloadEngine = useCallback(
    async (id: number, url: string) => {
      setInProgress(true);
      const path = await resolve(await appDataDir(), "engines");
      await invoke("download_file", {
        id,
        url,
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
      setEngines(async (prev) => [
        ...(await prev),
        {
          ...engine,
          path: enginePath,
        },
      ]);
    },
    [engine, setEngines]
  );

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
            <Text size="xs">{formatBytes(engine.downloadSize)}</Text>
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
