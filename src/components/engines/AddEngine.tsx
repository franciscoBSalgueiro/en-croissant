import { events, commands } from "@/bindings";
import {
  enginesAtom,
  loadableEnginesAtom,
  persistEnginesAtom,
} from "@/state/atoms";
import {
  type Engine,
  type LocalEngine,
  requiredEngineSettings,
  saveEngines,
} from "@/utils/engines";
import { usePlatform } from "@/utils/files";
import { formatBytes } from "@/utils/format";
import { unwrap } from "@/utils/unwrap";
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
import { info } from "@tauri-apps/plugin-log";
import { useAtom, useAtomValue } from "jotai";
import { useSetAtom } from "jotai/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ProgressButton from "../common/ProgressButton";
import EngineForm from "./EngineForm";

function AddEngine({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const { t } = useTranslation();

  const allEngines = useAtomValue(loadableEnginesAtom);
  const [, setEngines] = useAtom(enginesAtom);
  const persist = useSetAtom(persistEnginesAtom);
  const engines =
    allEngines.state === "hasData"
      ? allEngines.data.filter(
          (e: Engine): e is LocalEngine => e.type === "local",
        )
      : [];

  const { os, arch, isLoading: platformLoading } = usePlatform();

  const getStockfishEngine = (): LocalEngine | null => {
    if (!os || !arch) return null;

    let engineInfo: Partial<LocalEngine> = {
      type: "local",
      name: "Stockfish",
      image: "",
      elo: 3635,
      downloadSize: 0,
    };

    if (os === "macos") {
      if (arch === "aarch64") {
        engineInfo = {
          ...engineInfo,
          version: "Latest (Apple Silicon)",
          path: "stockfish/stockfish-macos-m1-apple-silicon",
          downloadLink:
            "https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-macos-m1-apple-silicon.tar",
        };
      } else {
        // x86_64
        engineInfo = {
          ...engineInfo,
          version: "Latest (Intel)",
          path: "stockfish/stockfish-macos-x86-64-modern",
          downloadLink:
            "https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-macos-x86-64-modern.tar",
        };
      }
    } else if (os === "windows") {
      engineInfo = {
        ...engineInfo,
        version: "Latest (AVX2)",
        path: "stockfish/stockfish-windows-x86-64-avx2.exe",
        downloadLink:
          "https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-windows-x86-64-avx2.zip",
      };
    } else if (os === "linux") {
      engineInfo = {
        ...engineInfo,
        version: "Latest (AVX2)",
        path: "stockfish/stockfish-linux-x86-64-avx2",
        downloadLink:
          "https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-linux-x86-64-avx2.tar.zst",
      };
    } else {
      return null;
    }

    return engineInfo as LocalEngine;
  };

  const stockfishEngine = getStockfishEngine();

  const form = useForm<LocalEngine>({
    initialValues: {
      type: "local",
      version: "",
      name: "",
      path: "",
      image: "",
      elo: undefined,
      loaded: false,
    },

    validate: {
      name: (value) => {
        if (!value) return t("Common.RequireName");
        if (engines.find((e: LocalEngine) => e.name === value))
          return t("Common.NameAlreadyUsed");
      },
      path: (value) => {
        if (!value) return t("Common.RequirePath");
      },
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Engines.Add.Title")}
    >
      <Tabs defaultValue="download">
        <Tabs.List>
          <Tabs.Tab value="download">{t("Common.Download")}</Tabs.Tab>
          <Tabs.Tab value="local">{t("Common.Local")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="download" pt="xs">
          {platformLoading && (
            <Center>
              <Loader />
            </Center>
          )}
          {stockfishEngine && (
            <ScrollArea.Autosize mah={500} offsetScrollbars>
              <Stack>
                <EngineCard
                  engine={stockfishEngine}
                  engineId={0}
                  initInstalled={engines.some(
                    (e: LocalEngine) =>
                      e.name === stockfishEngine.name &&
                      e.version === stockfishEngine.version,
                  )}
                />
              </Stack>
            </ScrollArea.Autosize>
          )}
          {!stockfishEngine && !platformLoading && (
            <Text>Stockfish is not available for your platform.</Text>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <EngineForm
            submitLabel={t("Common.Add")}
            form={form}
            onSubmit={async (values: LocalEngine) => {
              if (allEngines.state !== "hasData") return;
              await info(
                `AddEngine.local: adding engine name=${values.name} path=${values.path}`,
              );
              const updatedEngines = [...allEngines.data, values];
              setEngines(updatedEngines);
              await saveEngines(updatedEngines);
              await persist(updatedEngines as any);
              await info(
                `AddEngine.local: saved engines count=${updatedEngines.length}`,
              );
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
  engine: LocalEngine;
  engineId: number;
  initInstalled: boolean;
}) {
  const { t } = useTranslation();

  const [inProgress, setInProgress] = useState<boolean>(false);
  const [, setEngines] = useAtom(enginesAtom);
  const allEngines = useAtomValue(loadableEnginesAtom);
  const persist = useSetAtom(persistEnginesAtom);

  const downloadEngine = useCallback(
    async (id: number, url: string) => {
      await info(`AddEngine.download: start id=${id} url=${url}`);
      setInProgress(true);
      let path = await resolve(
        await appDataDir(),
        "engines",
        `${url.slice(url.lastIndexOf("/") + 1)}`,
      );
      if (
        url.endsWith(".zip") ||
        url.endsWith(".tar") ||
        url.endsWith(".zst")
      ) {
        path = await resolve(await appDataDir(), "engines");
      }
      await info(`AddEngine.download: destination=${path}`);
      await commands.downloadFile(`engine_${id}`, url, path, null, null, null);
      let appDataDirPath = await appDataDir();
      if (appDataDirPath.endsWith("/") || appDataDirPath.endsWith("\\")) {
        appDataDirPath = appDataDirPath.slice(0, -1);
      }
      const enginePath = await join(
        appDataDirPath,
        "engines",
        ...engine.path.split("/"),
      );
      await info(`AddEngine.download: enginePath=${enginePath}`);
      await commands.setFileAsExecutable(enginePath);
      const config = unwrap(await commands.getEngineConfig(enginePath));
      await info(
        `AddEngine.download: loaded engine config options=${config.options.length}`,
      );
      const newEngine: LocalEngine = {
        ...engine,
        type: "local",
        path: enginePath,
        loaded: true,
        settings: config.options
          .filter(
            (o) =>
              requiredEngineSettings.includes(o.value.name) &&
              "default" in o.value,
          )
          .map((o) => ({
            name: o.value.name,
            value: (o.value as { default: string | number | boolean | null })
              .default,
          })),
      };
      if (allEngines.state !== "hasData") return;
      const updatedEngines = [...allEngines.data, newEngine];
      setEngines(updatedEngines);
      await saveEngines(updatedEngines);
      await persist(updatedEngines as any);
      await info(
        `AddEngine.download: engine added name=${newEngine.name}, total=${updatedEngines.length}`,
      );
      setInProgress(false);
    },
    [engine, setEngines, allEngines, persist],
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
              completed: t("Common.Installed"),
              action: t("Common.Install"),
              inProgress: t("Common.Downloading"),
              finalizing: t("Common.Extracting"),
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
