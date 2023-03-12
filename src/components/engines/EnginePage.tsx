import {
  ActionIcon,
  Button,
  Group,
  Image,
  ScrollArea,
  Table,
  Text,
  Title
} from "@mantine/core";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import {
  Engine,
  EngineSettings,
  EngineStatus,
  getEngineSettings
} from "../../utils/engines";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";

export default function EnginePage() {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [opened, setOpened] = useState(false);
  const [engineSettings, setEngineSettings] = useState<EngineSettings[]>([]);
  const [loadedEngines, setLoadedEngines] = useState(false);

  async function readConfig() {
    setEngineSettings(await getEngineSettings());
    setLoadedEngines(true);
  }

  useEffect(() => {
    readConfig();
  }, []);

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
          elo: engine.elo,
        };
      })
    );

    setEngines(engines);
  }

  async function removeEngine(id: number) {
    const newEngineSettings = engineSettings.filter(
      (e) => e.name !== engines[id].name
    );
    setEngineSettings(newEngineSettings);
  }

  useEffect(() => {
    if (!loadedEngines) return;
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
  }, [engineSettings, loadedEngines]);

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
              <th>Elo</th>
              <th>Actions</th>
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
                    <td>{item.elo}</td>
                    <td>
                      <ActionIcon>
                        <IconTrash
                          size={20}
                          onClick={() => removeEngine(index)}
                        />
                      </ActionIcon>
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
