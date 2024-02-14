import { enginesAtom } from "@/atoms/atoms";
import { events, commands } from "@/bindings";
import {
  LocalEngine,
  RemoteEngine,
  requiredEngineSettings,
  useDefaultEngines,
} from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { formatBytes } from "@/utils/format";
import { invoke, unwrap } from "@/utils/invoke";
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconDatabase, IconTrophy } from "@tabler/icons-react";
import { appDataDir, join, resolve } from "@tauri-apps/api/path";
import { useAtom } from "jotai";
import { useCallback, useState } from "react";
import ProgressButton from "../common/ProgressButton";
import EngineForm from "./EngineForm";

function AddEngine({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const [allEngines, setEngines] = useAtom(enginesAtom);
  const engines = allEngines.filter(
    (e): e is LocalEngine => e.type === "local",
  );

  const { os } = usePlatform();

  const { defaultEngines, error, isLoading } = useDefaultEngines(os, opened);

  const form = useForm<LocalEngine>({
    initialValues: {
      type: "local",
      version: "",
      name: "",
      path: "",
      image: "",
      elo: undefined,
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
      <Tabs defaultValue="download">
        <Tabs.List>
          <Tabs.Tab value="download">Download</Tabs.Tab>
          <Tabs.Tab value="cloud">Cloud</Tabs.Tab>
          <Tabs.Tab value="local">Local</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="download" pt="xs">
          {isLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          <ScrollArea.Autosize mah={500} offsetScrollbars>
            <Stack>
              {defaultEngines?.map((engine, i) => (
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
        <Tabs.Panel value="cloud" pt="xs">
          <Stack>
            <CloudCard
              engine={{
                name: "ChessDB",
                type: "chessdb",
                url: "https://chessdb.cn",
              }}
            />
            <CloudCard
              engine={{
                name: "Lichess Cloud",
                type: "lichess",
                url: "https://lichess.org",
              }}
            />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <EngineForm
            submitLabel="Add"
            form={form}
            onSubmit={(values: LocalEngine) => {
              setEngines(async (prev) => [...(await prev), values]);
              setOpened(false);
            }}
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function CloudCard({ engine }: { engine: RemoteEngine }) {
  const [engines, setEngines] = useAtom(enginesAtom);
  return (
    <Paper withBorder radius="md" p={0} key={engine.name}>
      <Group wrap="nowrap" gap={0} grow>
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            ENGINE
          </Text>
          <Text fw="bold">{engine.name}</Text>
          <Text size="xs" c="dimmed" mb="xs">
            {engine.url}
          </Text>
          <Button
            disabled={engines.find((e) => e.type === engine.type) !== undefined}
            fullWidth
            onClick={() => {
              setEngines(async (prev) => [
                ...(await prev),
                {
                  ...engine,
                  type: engine.type,
                  loaded: true,
                  settings: [
                    {
                      name: "MultiPV",
                      value: "1",
                    },
                  ],
                },
              ]);
            }}
          >
            Add
          </Button>
        </Box>
      </Group>
    </Paper>
  );
}

function EngineCard({
  engine,
  engineId,
  initInstalled,
}: {
  engine: LocalEngine;
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
        id: `engine_${id}`,
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
        ...engine.path.split("/"),
      );
      await invoke("set_file_as_executable", { path: enginePath });
      const config = unwrap(await commands.getEngineConfig(enginePath));
      setEngines(async (prev) => [
        ...(await prev),
        {
          ...engine,
          type: "local",
          path: enginePath,
          loaded: true,
          settings: config.options
            .filter((o) => requiredEngineSettings.includes(o.value.name))
            .map((o) => ({
              name: o.value.name,
              // @ts-expect-error
              value: o.value.default,
            })),
        },
      ]);
    },
    [engine, setEngines],
  );

  return (
    <Paper withBorder radius="md" p={0} key={engine.name}>
      <Group wrap="nowrap" gap={0} grow>
        {engine.image && (
          <Box w="2rem" px="xs">
            <Image src={engine.image} alt={engine.name} fit="contain" />
          </Box>
        )}
        <Box p="md" flex={1}>
          <Text tt="uppercase" c="dimmed" fw={700} size="xs">
            ENGINE
          </Text>
          <Text fw="bold" mb="xs">
            {engine.name} {engine.version}
          </Text>
          <Group wrap="nowrap" gap="xs">
            <IconTrophy size="1rem" />
            <Text size="xs">{`${engine.elo} ELO`}</Text>
          </Group>
          <Group wrap="nowrap" gap="xs" mb="xs">
            <IconDatabase size="1rem" />
            <Text size="xs">{formatBytes(engine.downloadSize ?? 0)}</Text>
          </Group>
          <ProgressButton
            id={`engine_${engineId}`}
            progressEvent={events.downloadProgress}
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
        </Box>
      </Group>
    </Paper>
  );
}

export default AddEngine;
