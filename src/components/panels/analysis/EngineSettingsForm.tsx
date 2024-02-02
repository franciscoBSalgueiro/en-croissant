import { enginesAtom } from "@/atoms/atoms";
import { GoMode } from "@/bindings";
import { EngineSettings } from "@/utils/engines";
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
import {
  IconDownload,
  IconPlus,
  IconSettings,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { open, save } from "@tauri-apps/api/dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { useAtom } from "jotai";
import React, { memo, useState } from "react";
import CoresSlider from "./CoresSlider";
import DepthSlider from "./DepthSlider";
import HashSlider from "./HashSlider";
import LinesSlider from "./LinesSlider";

interface EngineSettingsProps {
  engineName: string;
  settings: { enabled: boolean; go: GoMode; settings: EngineSettings };
  setSettings: (
    fn: (prev: { enabled: boolean; go: GoMode; settings: EngineSettings }) => {
      enabled: boolean;
      go: GoMode;
      settings: EngineSettings;
    },
  ) => void;
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
  const multipv = settings.settings.find((o) => o.name === "MultiPV");
  const threads = settings.settings.find((o) => o.name === "Threads");
  const hash = settings.settings.find((o) => o.name === "Hash");

  return (
    <>
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

          {!minimal && multipv && (
            <Group grow>
              <Text size="sm" fw="bold">
                Number of Lines
              </Text>
              <LinesSlider
                value={Number(multipv.value || 1)}
                setValue={(v) =>
                  setSettings((prev) => {
                    return {
                      ...prev,
                      settings: prev.settings.map((o) =>
                        o.name === "MultiPV" ? { ...o, value: v || 1 } : o,
                      ),
                    };
                  })
                }
                color={color}
              />
            </Group>
          )}

          {!remote && threads && (
            <>
              <Group grow>
                <Text size="sm" fw="bold">
                  Number of cores
                </Text>
                <CoresSlider
                  value={Number(threads.value || 1)}
                  setValue={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      settings: prev.settings.map((o) =>
                        o.name === "Threads" ? { ...o, value: v || 1 } : o,
                      ),
                    }))
                  }
                  color={color}
                />
              </Group>

              {hash && (
                <Group grow>
                  <Text size="sm" fw="bold">
                    Size of Hash
                  </Text>
                  <HashSlider
                    value={Number(hash.value || 1)}
                    setValue={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        settings: prev.settings.map((o) =>
                          o.name === "Hash" ? { ...o, value: v || 1 } : o,
                        ),
                      }))
                    }
                    color={color}
                  />
                </Group>
              )}
            </>
          )}
        </Stack>
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
  settings: { enabled: boolean; go: GoMode; settings: EngineSettings };
  setSettings: (
    fn: (prev: { enabled: boolean; go: GoMode; settings: EngineSettings }) => {
      enabled: boolean;
      go: GoMode;
      settings: EngineSettings;
    },
  ) => void;
  minimal?: boolean;
}) {
  const goTypes = ["Depth", { label: "Time (ms)", value: "Time" }, "Nodes"];
  if (!minimal) goTypes.push("Infinite");

  const multipv = settings.settings.find((o) => o.name === "MultiPV");
  const threads = settings.settings.find((o) => o.name === "Threads");
  const hash = settings.settings.find((o) => o.name === "Hash");

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
                      newGo.c = undefined;
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
          {threads && (
            <Table.Tr>
              <Table.Td>Threads</Table.Td>
              <Table.Td>
                <NumberInput
                  min={1}
                  value={Number(threads.value || 1)}
                  onChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      settings: prev.settings.map((o) =>
                        o.name === "Threads"
                          ? { ...o, value: (v || 1).toString() }
                          : o,
                      ),
                    }))
                  }
                />
              </Table.Td>
            </Table.Tr>
          )}
          {!minimal && multipv && (
            <Table.Tr>
              <Table.Td>MultiPV</Table.Td>
              <Table.Td>
                <NumberInput
                  min={1}
                  value={Number(multipv.value || 1)}
                  onChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      settings: prev.settings.map((o) =>
                        o.name === "MultiPV"
                          ? { ...o, value: (v || 1).toString() }
                          : o,
                      ),
                    }))
                  }
                />
              </Table.Td>
            </Table.Tr>
          )}
          {hash && (
            <Table.Tr>
              <Table.Td>Hash Size</Table.Td>
              <Table.Td>
                <NumberInput
                  min={1}
                  value={Number(hash.value || 1)}
                  onChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      settings: prev.settings.map((o) =>
                        o.name === "Hash"
                          ? { ...o, value: (v || 1).toString() }
                          : o,
                      ),
                    }))
                  }
                />
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Modal>
  );
}

export default memo(EngineSettingsForm);
