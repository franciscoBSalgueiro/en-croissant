import {
  Button,
  Group,
  Image,
  Input,
  Modal,
  ScrollArea,
  Table,
  Text,
  TextInput
} from "@mantine/core";
import { useForm } from "@mantine/form";

import { showNotification } from "@mantine/notifications";
import { IconCheck, IconPlus, IconReload, IconTrash } from "@tabler/icons";
import { open } from "@tauri-apps/api/dialog";
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
} from "../utils/engines";
import { ProgressButton } from "./ProgressButton";

export default function EngineTable() {
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

  const form = useForm<EngineSettings>({
    initialValues: {
      name: "",
      binary: "",
      image: "",
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

  async function downloadEngine(id: number, url: string) {
    invoke("download_file", {
      id,
      url,
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

  useEffect(() => {
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
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="New Engine"
      >
        <form
          onSubmit={form.onSubmit(async (values) => {
            setEngineSettings((engineSettings) => [...engineSettings, values]);
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
      </Modal>
      <ScrollArea>
        <Button leftIcon={<IconReload />} onClick={() => readConfig()}>
          Reload
        </Button>
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