import {
  Button,
  Group,
  Image,
  ScrollArea,
  Table,
  Text,
  Title
} from "@mantine/core";

import { showNotification } from "@mantine/notifications";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons";
import { listen } from "@tauri-apps/api/event";
import {
  BaseDirectory,
  exists,
  readTextFile,
  removeDir,
  writeTextFile
} from "@tauri-apps/api/fs";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import {
  Engine,
  EngineSettings,
  EngineStatus,
  getDefaultEngines,
  getEngineSettings
} from "../../utils/engines";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import { ProgressButton } from "./ProgressButton";

export default function EnginePage() {
  const defaultEngines = getDefaultEngines();
  const [engines, setEngines] = useState<Engine[]>(defaultEngines);
  const [opened, setOpened] = useState(false);
  const [engineSettings, setEngineSettings] = useState<EngineSettings[]>([]);

  async function readConfig() {
    setEngineSettings(await getEngineSettings());
  }

  async function reloadEngines() {
    const engines = await Promise.all(
      engineSettings.map(async (engine) => {
        const exists = await invoke("file_exists", {
          path: engine.binary,
        });
        return {
          image: engine.image,
          name: engine.name,
          status: exists ? EngineStatus.Installed : EngineStatus.NotInstalled,
          path: engine.binary,
        };
      })
    );
    const updatedDefaultEngines = await Promise.all(
      defaultEngines.map(async (engine) => {
        const installed = await exists(engine.path, {
          dir: BaseDirectory.AppData,
        });
        engine.status = installed
          ? EngineStatus.Installed
          : EngineStatus.NotInstalled;
        return engine;
      })
    );

    setEngines([...updatedDefaultEngines, ...engines]);
  }

  async function downloadEngine(id: number, url: string) {
    invoke("download_file", {
      id,
      url,
      zip: true,
      path: (await appDataDir()) + "engines",
    });
  }

  async function removeEngine(id: number) {
    if (engines[id].downloadLink) {
      await removeDir(
        engines[id].path.substring(0, engines[id].path.lastIndexOf("/")),
        { dir: BaseDirectory.AppData, recursive: true }
      );
      readConfig();
    } else {
      // Remove from config
      const newEngineSettings = engineSettings.filter(
        (e) => e.name !== engines[id].name
      );
      setEngineSettings(newEngineSettings);
    }
    showNotification({
      icon: <IconTrash />,
      color: "red",
      title: "Engine removed",
      message: "The engine has been installed successfully",
    });
  }

  useEffect(() => {
    async function getEngineProgress() {
      await listen("download_progress", (event) => {
        const { progress, id, finished } = event.payload as any;
        if (finished) {
          // FIXME - avoid duplicate notifications
          showNotification({
            icon: <IconCheck />,
            color: "green",
            title: "Engine installed",
            message: "The engine has been installed successfully",
          });
          reloadEngines();
        } else {
          setEngines((engines) =>
            engines.map((engine, index) => {
              if (index === id) {
                return {
                  ...engine,
                  progress,
                };
              }
              return engine;
            })
          );
        }
      });
    }

    readConfig();
    getEngineProgress();
    // refreshEngines();
  }, []);

  useEffect(() => {
    // update file if the contents of the file change
    readTextFile("engines/engines.json", { dir: BaseDirectory.AppData }).then(
      (text) => {
        const data = JSON.parse(text);
        if (data !== engineSettings) {
          writeTextFile(
            "engines/engines.json",
            JSON.stringify(engineSettings),
            {
              dir: BaseDirectory.AppData,
            }
          );
        }
      }
    );
    reloadEngines();
  }, [engineSettings]);

  function handleInstallClick(loaded: boolean, id: number) {
    if (loaded) {
      removeEngine(id);
    } else {
      downloadEngine(id, engines[id].downloadLink!);
    }
  }

  return (
    <>
      <AddEngine
        engines={engines}
        opened={opened}
        setOpened={setOpened}
        setEngineSettings={setEngineSettings}
      />
      <Group align="baseline" m={30}>
        <Title>Your Engines</Title>
        <OpenFolderButton folder="engines" />
      </Group>
      <ScrollArea>
        <Table sx={{ minWidth: 800 }} verticalSpacing="sm">
          <thead>
            <tr>
              <th>Engine</th>
              <th>Path</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {engines &&
              engines.map((item, index) => {
                return (
                  <tr key={index}>
                    <td>
                      <Group spacing="sm">
                        <Image
                          width={60}
                          height={60}
                          src={item.image !== "" ? item.image : null}
                        />
                        <Text size="md" weight={500}>
                          {item.name}
                        </Text>
                      </Group>
                    </td>
                    <td>
                      {item.path}
                      {item.status === EngineStatus.NotInstalled &&
                        !item.downloadLink && (
                          <Text c="red">ERROR: Missing File</Text>
                        )}
                    </td>
                    <td>
                      <ProgressButton
                        loaded={
                          !item.downloadLink ||
                          item.status === EngineStatus.Installed
                        }
                        onClick={handleInstallClick}
                        progress={item.progress ?? 0}
                        id={index}
                      />
                    </td>
                  </tr>
                );
              })}
            <tr>
              <td>
                <Button
                  onClick={() => setOpened(true)}
                  variant="default"
                  rightIcon={<IconPlus size={14} />}
                >
                  Add new
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </ScrollArea>
    </>
  );
}
