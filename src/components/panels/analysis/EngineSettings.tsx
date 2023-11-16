import { EngineSettings } from "@/atoms/atoms";
import {
  ActionIcon,
  Button,
  Center,
  Collapse,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import React, { memo, useState } from "react";
import CoresSlide from "./CoresSlider";
import DepthSlider from "./DepthSlider";
import LinesSlider from "./LinesSlider";
import { IconPlus, IconX } from "@tabler/icons-react";
import HashSlider from "./HashSlider";

interface EngineSettingsProps {
  engine: string;
  settingsOn: boolean;
  settings: EngineSettings;
  setSettings: React.Dispatch<React.SetStateAction<EngineSettings>>;
}

function EngineSettings({
  engine,
  settingsOn,
  settings,
  setSettings,
}: EngineSettingsProps) {
  const [advancedOptions, setAdvancedOptions] = useState(false);

  return (
    <>
      <AdvancedOptions
        opened={advancedOptions}
        setOpened={setAdvancedOptions}
        settings={settings}
        setSettings={setSettings}
      />
      <Collapse in={settingsOn} px={30} pb={15}>
        <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
          <Text size="sm" fw="bold">
            Number of Lines
          </Text>
          <LinesSlider
            value={settings.options.multipv}
            setValue={(v) =>
              setSettings((prev) => ({ ...prev, options: { ...prev.options, multipv: v } }))
            }
          />
          {settings.go.t === "Infinite" || settings.go.t === "Depth" ? (
            <>
              <Text size="sm" fw="bold">
                Depth
              </Text>
              <DepthSlider
                value={settings.go}
                setValue={(v) => setSettings((prev) => ({ ...prev, go: v }))}
              />
            </>
          ) : (
            <>
              <Text size="sm" fw="bold" pt={7}>
                {settings.go.t}
              </Text>
              <NumberInput
                min={1}
                variant="unstyled"
                value={settings.go.c}
                onChange={(v) =>
                  setSettings((prev) => {
                    return {
                      ...prev,
                      go: {
                        ...prev.go,
                        c: v || 1,
                      },
                    };
                  })
                }
              />
            </>
          )}
          <Text size="sm" fw="bold">
            Number of cores
          </Text>
          <CoresSlide
            value={settings.options.threads}
            setValue={(v) => setSettings((prev) => ({ ...prev, options: { ...prev.options, threads: v } }))}
          />

          <Text size="sm" fw="bold">
            Size of Hash
          </Text>
          <HashSlider
            value={settings.options.hash}
            setValue={(v) => setSettings((prev) => ({ ...prev, options: { ...prev.options, hash: v } }))}
          />
        </SimpleGrid>

        <Group>
          <Button
            variant="default"
            size="xs"
            mt="sm"
            onClick={() => setAdvancedOptions(true)}
          >
            Advanced options
          </Button>

          <Button
            size="xs"
            mt="sm"
            onClick={() => localStorage.setItem(`engine-${engine}`, JSON.stringify(settings))}
          >
            Save as default
          </Button>
        </Group>

      </Collapse>
    </>
  );
}

function AdvancedOptions({
  opened,
  setOpened,
  settings,
  setSettings,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
  settings: EngineSettings;
  setSettings: React.Dispatch<React.SetStateAction<EngineSettings>>;
}) {
  return (
    <Modal
      title="Engine Options"
      opened={opened}
      onClose={() => setOpened(false)}
    >
      <Table>
        <tbody>
          <tr>
            <td>
              <Select
                variant="unstyled"
                dropdownPosition="bottom"
                data={["Depth", "Time", "Nodes", "Infinite"]}
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
            </td>
            <td>
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
                          c: v || 1,
                        },
                      };
                    })
                  }
                />
              )}
            </td>
          </tr>
          <tr>
            <td>Threads</td>
            <td>
              <NumberInput
                min={1}
                value={settings.options.threads}
                onChange={(v) =>
                  setSettings((prev) => ({ ...prev, options: { ...prev.options, threads: v || 1 } }))
                }
              />
            </td>
          </tr>
          <tr>
            <td>MultiPV</td>
            <td>
              <NumberInput
                min={1}
                value={settings.options.multipv}
                onChange={(v) =>
                  setSettings((prev) => ({ ...prev, options: { ...prev.options, multipv: v || 1 } }))
                }
              />
            </td>
          </tr>
          <tr>
            <td>Hash Size</td>
            <td>
              <NumberInput
                min={1}
                value={settings.options.hash}
                onChange={(v) =>
                  setSettings((prev) => ({ ...prev, options: { ...prev.options, hash: v || 1 } }))
                }
              />
            </td>
          </tr>
          {settings.options.extraOptions.map((option, i) => (
            <tr key={i}>
              <td>
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
              </td>
              <td>
                <Group noWrap spacing={0}>
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
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Center pt="xs">
        <Button
          leftIcon={<IconPlus size={16} />}
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

export default memo(EngineSettings);
