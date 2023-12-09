import { EngineSettings, enginesAtom } from "@/atoms/atoms";
import {
  ActionIcon,
  Button,
  Center,
  Group,
  MantineColor,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import React, { memo, useState } from "react";
import DepthSlider from "./DepthSlider";
import LinesSlider from "./LinesSlider";
import {
  IconDownload,
  IconPlus,
  IconSettings,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import HashSlider from "./HashSlider";
import { save, open } from "@tauri-apps/api/dialog";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { useAtom } from "jotai";
import CoresSlider from "./CoresSlider";

interface EngineSettingsProps {
  engineName: string;
  settings: EngineSettings;
  setSettings: (fn: (prev: EngineSettings) => EngineSettings) => void;
  color?: MantineColor;
  minimal?: boolean;
  remote: boolean;
}

function EngineSettingsForm({
  engineName,
  settings,
  setSettings,
  color,
  minimal,
  remote,
}: EngineSettingsProps) {
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [, setEngines] = useAtom(enginesAtom);

  async function saveSettings() {
    const defaultPath = await resolve(
      await appDataDir(),
      "presets",
      engineName + ".json"
    );
    const file = await save({
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!file) return;
    const json = JSON.stringify(settings);
    await writeTextFile(file, json);
    setEngines(async (prev) => {
      const newEngines = (await prev).map((e) => {
        if (e.name === engineName) {
          return {
            ...e,
            settings: settings,
          };
        }
        return e;
      });
      return newEngines;
    });
  }

  async function loadSettings() {
    const configsDirectory = await resolve(await appDataDir(), "presets");
    const file = await open({
      defaultPath: configsDirectory,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (typeof file !== "string") return;
    const data = await readTextFile(file);
    if (!data) return;
    const json = JSON.parse(data);
    setSettings(() => json);
    setEngines(async (prev) => {
      const newEngines = (await prev).map((e) => {
        if (e.name === engineName) {
          return {
            ...e,
            settings: json,
          };
        }
        return e;
      });
      return newEngines;
    });
  }

  return (
    <>
      <AdvancedOptions
        opened={advancedOptions}
        setOpened={setAdvancedOptions}
        settings={settings}
        setSettings={setSettings}
        minimal={minimal}
      />
      <Stack pt="sm">
        <Stack>
          {remote ? (
            <></>
          ) : settings.go.t === "Infinite" || settings.go.t === "Depth" ? (
            <Group grow>
              <Text size="sm" fw="bold">
                Depth
              </Text>
              <DepthSlider
                value={settings.go}
                setValue={(v) => setSettings((prev) => ({ ...prev, go: v }))}
                color={color}
              />
            </Group>
          ) : (
            <Group grow>
              <Text size="sm" fw="bold" pt={7}>
                {settings.go.t === "Time" ? "Time (ms)" : "Nodes"}
              </Text>
              <NumberInput
                min={1}
                value={settings.go.c}
                onChange={(v) =>
                  setSettings((prev) => {
                    return {
                      ...prev,
                      go: {
                        ...prev.go,
                        c: (v || 1) as number,
                      },
                    };
                  })
                }
              />
            </Group>
          )}

          {!minimal && (
            <Group grow>
              <Text size="sm" fw="bold">
                Number of Lines
              </Text>
              <LinesSlider
                value={settings.options.multipv}
                setValue={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    options: { ...prev.options, multipv: v },
                  }))
                }
                color={color}
              />
            </Group>
          )}

          {!remote && (
            <>
              <Group grow>
                <Text size="sm" fw="bold">
                  Number of cores
                </Text>
                <CoresSlider
                  value={settings.options.threads}
                  setValue={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      options: { ...prev.options, threads: v },
                    }))
                  }
                  color={color}
                />
              </Group>

              <Group grow>
                <Text size="sm" fw="bold">
                  Size of Hash
                </Text>
                <HashSlider
                  value={settings.options.hash}
                  setValue={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      options: { ...prev.options, hash: v },
                    }))
                  }
                  color={color}
                />
              </Group>
            </>
          )}
        </Stack>

        {!remote && (
          <Group gap={0}>
            <Tooltip label="Load settings">
              <ActionIcon onClick={() => loadSettings()}>
                <IconUpload size="1rem" />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Save settings">
              <ActionIcon onClick={() => saveSettings()}>
                <IconDownload size="1rem" />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Advanced Options">
              <ActionIcon onClick={() => setAdvancedOptions(true)}>
                <IconSettings size="1rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Stack>
    </>
  );
}

function AdvancedOptions({
  opened,
  setOpened,
  settings,
  setSettings,
  minimal,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
  settings: EngineSettings;
  setSettings: (fn: (prev: EngineSettings) => EngineSettings) => void;
  minimal?: boolean;
}) {
  const goTypes = ["Depth", { label: "Time (ms)", value: "Time" }, "Nodes"];
  if (!minimal) goTypes.push("Infinite");
  return (
    <Modal
      title="Engine Options"
      opened={opened}
      onClose={() => setOpened(false)}
    >
      <Table>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>
              <Select
                allowDeselect={false}
                variant="unstyled"
                comboboxProps={{
                  position: "bottom",
                  middlewares: { flip: false, shift: false },
                }}
                data={goTypes}
                value={settings.go.t}
                onChange={(v) =>
                  setSettings((prev) => {
                    const newGo = prev.go;
                    newGo.t = v as "Depth" | "Time" | "Nodes" | "Infinite";
                    if (v === "Infinite") {
                      /// @ts-expect-error idk how to please ts here
                      delete newGo.c;
                    }
                    return {
                      ...prev,
                      go: newGo,
                    };
                  })
                }
              />
            </Table.Td>
            <Table.Td>
              {settings.go.t !== "Infinite" && (
                <NumberInput
                  min={1}
                  value={settings.go.c}
                  onChange={(v) =>
                    setSettings((prev) => {
                      return {
                        ...prev,
                        go: {
                          ...prev.go,
                          c: (v || 1) as number,
                        },
                      };
                    })
                  }
                />
              )}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Threads</Table.Td>
            <Table.Td>
              <NumberInput
                min={1}
                value={settings.options.threads}
                onChange={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    options: { ...prev.options, threads: (v || 1) as number },
                  }))
                }
              />
            </Table.Td>
          </Table.Tr>
          {!minimal && (
            <Table.Tr>
              <Table.Td>MultiPV</Table.Td>
              <Table.Td>
                <NumberInput
                  min={1}
                  value={settings.options.multipv}
                  onChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      options: { ...prev.options, multipv: (v || 1) as number },
                    }))
                  }
                />
              </Table.Td>
            </Table.Tr>
          )}
          <Table.Tr>
            <Table.Td>Hash Size</Table.Td>
            <Table.Td>
              <NumberInput
                min={1}
                value={settings.options.hash}
                onChange={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    options: { ...prev.options, hash: (v || 1) as number },
                  }))
                }
              />
            </Table.Td>
          </Table.Tr>
          {settings.options.extraOptions.map((option, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                <TextInput
                  value={option.name}
                  onChange={(e) => {
                    const newOptions = settings.options.extraOptions;
                    newOptions[i].name = e.currentTarget.value;
                    setSettings((prev) => ({
                      ...prev,
                      extraOptions: newOptions,
                    }));
                  }}
                />
              </Table.Td>
              <Table.Td>
                <Group wrap="nowrap" gap={0}>
                  <TextInput
                    value={option.value}
                    onChange={(e) => {
                      const newOptions = settings.options.extraOptions;
                      newOptions[i].value = e.currentTarget.value;
                      setSettings((prev) => ({
                        ...prev,
                        extraOptions: newOptions,
                      }));
                    }}
                  />
                  {/* Remove button */}
                  <ActionIcon
                    onClick={() => {
                      const newOptions = settings.options.extraOptions;
                      newOptions.splice(i, 1);
                      setSettings((prev) => ({
                        ...prev,
                        extraOptions: newOptions,
                      }));
                    }}
                  >
                    <IconX size="0.875rem" />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Center pt="xs">
        <Button
          leftSection={<IconPlus size="1rem" />}
          variant="default"
          size="xs"
          onClick={() => {
            const newOptions = settings.options.extraOptions;
            newOptions.push({ name: "", value: "" });
            setSettings((prev) => ({
              ...prev,
              extraOptions: newOptions,
            }));
          }}
        >
          Add option
        </Button>
      </Center>
    </Modal>
  );
}

export default memo(EngineSettingsForm);
