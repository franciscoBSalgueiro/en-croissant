import { enginesAtom } from "@/atoms/atoms";
import { Engine, LocalEngine } from "@/utils/engines";
import {
  ActionIcon,
  Box,
  Center,
  Checkbox,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconCloud,
  IconPhotoPlus,
  IconPlus,
  IconRobot,
} from "@tabler/icons-react";
import { exists } from "@tauri-apps/api/fs";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import useSWRImmutable from "swr/immutable";

import GenericCard from "../common/GenericCard";
import * as classes from "@/components/common/GenericCard.css";
import { unwrap } from "@/utils/invoke";
import { UciOptionConfig, commands } from "@/bindings";
import { P, match } from "ts-pattern";
import { open } from "@tauri-apps/api/dialog";
import LocalImage from "../common/LocalImage";

export default function EnginesPage() {
  const engines = useAtomValue(enginesAtom);
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedEngine = selected !== null ? engines[selected] : null;

  return (
    <Stack h="100%" px="lg" pb="lg">
      <AddEngine opened={opened} setOpened={setOpened} />
      <Group align="baseline" py="sm">
        <Title>Your Engines</Title>
        <OpenFolderButton base="AppDir" folder="engines" />
      </Group>
      <Group grow flex={1} style={{ overflow: "hidden" }} align="start">
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: "md", md: "sm" }}
          >
            {engines.map((item, i) => {
              const stats =
                item.type === "local"
                  ? [
                      {
                        label: "ELO",
                        value: item.elo ? item.elo.toString() : "??",
                      },
                    ]
                  : [{ label: "Type", value: "Cloud" }];
              if (item.type === "local" && item.version) {
                stats.push({
                  label: "Version",
                  value: item.version,
                });
              }
              return (
                <GenericCard
                  id={i}
                  key={item.name}
                  isSelected={selected === i}
                  setSelected={setSelected}
                  error={undefined}
                  Header={<EngineName engine={item} />}
                  stats={stats}
                />
              );
            })}
            <Box
              className={classes.card}
              component="button"
              type="button"
              onClick={() => setOpened(true)}
            >
              <Stack gap={0} justify="center" w="100%" h="100%">
                <Text mb={10}>Add New</Text>
                <Box>
                  <IconPlus size="1.3rem" />
                </Box>
              </Stack>
            </Box>
          </SimpleGrid>
        </ScrollArea>
        {selectedEngine === null || selected === null ? (
          <Text ta="center">No engine selected</Text>
        ) : selectedEngine.type === "local" ? (
          <EngineSettings selected={selected} />
        ) : (
          <Stack>
            <Text ta="center" fw="bold" fz="lg">
              {selectedEngine.type === "lichess" ? "Lichess Cloud" : "ChessDB"}
            </Text>
            <Text>{selectedEngine.url}</Text>
          </Stack>
        )}
      </Group>
    </Stack>
  );
}

function EngineSettings({ selected }: { selected: number }) {
  const [engines, setEngines] = useAtom(enginesAtom);
  const engine = engines[selected] as LocalEngine;
  const { data: options } = useSWRImmutable(
    ["engine-config", engine.path],
    async ([, path]) => {
      return unwrap(await commands.getEngineConfig(path));
    },
  );

  function setEngine(newEngine: LocalEngine) {
    setEngines(async (prev) => {
      const copy = [...(await prev)];
      copy[selected] = newEngine;
      return copy;
    });
  }

  // if (options) {
  //   for (const option of engine.settings || []) {
  //     const opt = options.options.find((o) => o.value.name === option.name);
  //     if (opt && opt.type !== "button") {
  //       // @ts-ignore
  //       opt.value.value = option.value || opt.value.default;
  //     }
  //   }
  // }
  const completeOptions: any =
    options?.options
      .filter((option) => option.type !== "button")
      .map((option) => {
        const setting = engine.settings?.find(
          (setting) => setting.name === option.value.name,
        );
        return {
          ...option,
          value: {
            ...option.value,
            value:
              setting?.value !== undefined
                ? setting.value
                : // @ts-ignore
                  option.value.default,
          },
        };
      }) || [];

  function changeImage() {
    open({
      title: "Select image",
    }).then((res) => {
      if (typeof res === "string") {
        setEngine({ ...engine, image: res });
      }
    });
  }

  function setSetting(
    name: string,
    value: string | number | boolean | null,
    def: string | number | boolean | null,
  ) {
    const newSettings = engine.settings || [];
    const setting = newSettings.find((setting) => setting.name === name);
    if (setting) {
      setting.value = value;
    } else {
      newSettings.push({ name, value });
    }
    if (value !== def) {
      setEngine({
        ...engine,
        settings: newSettings,
      });
    } else {
      setEngine({
        ...engine,
        settings: newSettings.filter((setting) => setting.name !== name),
      });
    }
  }

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label="General settings" />
        <Group grow align="start" wrap="nowrap">
          <Stack>
            <Group wrap="nowrap" w="100%">
              <TextInput
                flex={1}
                label="Name"
                value={engine.name}
                onChange={(e) =>
                  setEngine({ ...engine, name: e.currentTarget.value })
                }
              />
              <TextInput
                label="Version"
                w="5rem"
                value={engine.version}
                placeholder="?"
                onChange={(e) =>
                  setEngine({ ...engine, version: e.currentTarget.value })
                }
              />
            </Group>
            <Group grow>
              <NumberInput
                label="ELO"
                value={engine.elo || undefined}
                min={0}
                placeholder="Unknown"
                onChange={(v) =>
                  setEngine({
                    ...engine,
                    elo: typeof v === "number" ? v : undefined,
                  })
                }
              />
            </Group>
            <Checkbox
              label="Enabled"
              checked={!!engine.loaded}
              onChange={(e) =>
                setEngine({ ...engine, loaded: e.currentTarget.checked })
              }
            />
          </Stack>
          <Center>
            {engine.image ? (
              <Paper
                withBorder
                style={{ cursor: "pointer" }}
                onClick={changeImage}
              >
                <LocalImage
                  src={engine.image}
                  alt={engine.name}
                  mah="10rem"
                  maw="100%"
                />
              </Paper>
            ) : (
              <ActionIcon
                size="10rem"
                variant="subtle"
                styles={{
                  root: {
                    border: "1px dashed",
                  },
                }}
                onClick={changeImage}
              >
                <IconPhotoPlus size="2.5rem" />
              </ActionIcon>
            )}
          </Center>
        </Group>
        <Divider variant="dashed" label="Advanced settings" />
        <SimpleGrid cols={2}>
          {completeOptions
            .filter((option: { type: string }) => option.type !== "check")
            .map((option: any) => {
              return match(option)
                .with({ type: "spin", value: P.select() }, (v: any) => {
                  return (
                    <NumberInput
                      label={v.name}
                      min={Number(v.min)}
                      max={Number(v.max)}
                      value={Number(v.value)}
                      onChange={(e) => setSetting(v.name, e, Number(v.default))}
                    />
                  );
                })
                .with({ type: "combo", value: P.select() }, (v: any) => {
                  return (
                    <Select
                      label={v.name}
                      data={v.var}
                      value={v.value}
                      onChange={(e) => setSetting(v.name, e, v.default)}
                    />
                  );
                })
                .with({ type: "string", value: P.select() }, (v: any) => {
                  if (
                    v.name.toLowerCase().includes("file") ||
                    v.name.toLowerCase().includes("path")
                  ) {
                    const file = v.value ? new File([v.value], v.value) : null;
                    return (
                      <FileInput
                        clearable
                        label={v.name}
                        value={file}
                        onChange={(e) =>
                          setSetting(v.name, e?.name || null, v.default)
                        }
                      />
                    );
                  }
                  return (
                    <TextInput
                      label={v.name}
                      value={v.value || ""}
                      onChange={(e) =>
                        setSetting(v.name, e.currentTarget.value, v.default)
                      }
                    />
                  );
                })
                .otherwise(() => null);
            })}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          {completeOptions
            .filter((option: any) => option.type === "check")
            .map((o: any) => {
              return (
                <Checkbox
                  label={o.value.name}
                  checked={!!o.value.value}
                  onChange={(e) =>
                    setSetting(
                      o.value.name,
                      e.currentTarget.checked,
                      // @ts-ignore
                      o.value.default,
                    )
                  }
                />
              );
            })}
        </SimpleGrid>
      </Stack>
    </ScrollArea>
  );
}

function EngineName({ engine }: { engine: Engine }) {
  const { data: fileExists } = useSWRImmutable(
    ["file-exists", engine.type === "local" ? engine.path : null],
    async ([, path]) => {
      if (engine.type !== "local") return true;
      return await exists(path!);
    },
  );

  const hasError = engine.type === "local" && !fileExists;

  return (
    <Group wrap="nowrap">
      {engine.image ? (
        <LocalImage src={engine.image} alt={engine.name} h="2.5rem" />
      ) : engine.type !== "local" ? (
        <IconCloud size="2.5rem" />
      ) : (
        <IconRobot size="2.5rem" />
      )}
      <Stack gap={0}>
        <Text fw="bold" lineClamp={1} c={hasError ? "red" : undefined}>
          {engine.name} {hasError ? "(file missing)" : ""}
        </Text>
        <Text
          size="xs"
          c="dimmed"
          style={{ wordWrap: "break-word" }}
          lineClamp={1}
        >
          {engine.type === "local"
            ? engine.path.split(/\/|\\/).slice(-1)[0]
            : engine.url}
        </Text>
      </Stack>
    </Group>
  );
}
