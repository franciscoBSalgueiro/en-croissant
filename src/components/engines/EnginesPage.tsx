import { enginesAtom } from "@/atoms/atoms";
import {
  Engine,
  LocalEngine,
  engineSchema,
  requiredEngineSettings,
} from "@/utils/engines";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  FileInput,
  Group,
  JsonInput,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Space,
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
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";

import { commands } from "@/bindings";
import * as classes from "@/components/common/GenericCard.css";
import { unwrap } from "@/utils/invoke";
import { useToggle } from "@mantine/hooks";
import { open } from "@tauri-apps/api/dialog";
import { useSearchParams } from "react-router-dom";
import { P, match } from "ts-pattern";
import ConfirmModal from "../common/ConfirmModal";
import GenericCard from "../common/GenericCard";
import GoModeInput from "../common/GoModeInput";
import LocalImage from "../common/LocalImage";
import LinesSlider from "../panels/analysis/LinesSlider";

export default function EnginesPage() {
  const [engines, setEngines] = useAtom(enginesAtom);
  const [opened, setOpened] = useState(false);
  const [params, setParams] = useSearchParams();
  const selected = params.get("load") ? Number(params.get("load")) : null;
  const setSelected = (v: number | null) => {
    if (v === null) {
      params.delete("load");
    } else {
      params.set("load", v.toString());
    }
    setParams(params);
  };

  const selectedEngine =
    typeof selected === "number" ? engines[selected] || null : null;

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
        <Paper withBorder p="md" h="100%">
          {selectedEngine === null || selected === null ? (
            <Text ta="center">No engine selected</Text>
          ) : selectedEngine.type === "local" ? (
            <EngineSettings selected={selected} setSelected={setSelected} />
          ) : (
            <Stack>
              <Divider variant="dashed" label="General settings" />

              <TextInput
                w="50%"
                label="Name"
                value={selectedEngine.name}
                onChange={(e) => {
                  setEngines(async (prev) => {
                    const copy = [...(await prev)];
                    copy[selected].name = e.currentTarget.value;
                    return copy;
                  });
                }}
              />

              <Checkbox
                label="Enabled"
                checked={!!selectedEngine.loaded}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setEngines(async (prev) => {
                    const copy = [...(await prev)];
                    copy[selected].loaded = checked;
                    return copy;
                  });
                }}
              />

              <Divider variant="dashed" label="Advanced Settings" />
              <Stack w="50%">
                <Text fw="bold">Number of lines</Text>
                <LinesSlider
                  value={
                    Number(
                      selectedEngine.settings?.find(
                        (setting) => setting.name === "MultiPV",
                      )?.value,
                    ) || 1
                  }
                  setValue={(v) => {
                    setEngines(async (prev) => {
                      const copy = [...(await prev)];
                      const setting = copy[selected].settings?.find(
                        (setting) => setting.name === "MultiPV",
                      );
                      if (setting) {
                        setting.value = v;
                      } else {
                        copy[selected].settings?.push({
                          name: "MultiPV",
                          value: v,
                        });
                      }
                      return copy;
                    });
                  }}
                />
              </Stack>

              <Group justify="right">
                <Button
                  color="red"
                  onClick={() => {
                    setEngines(async (prev) => {
                      const copy = [...(await prev)];
                      copy.splice(selected, 1);
                      return copy;
                    });
                    setSelected(null);
                  }}
                >
                  Remove
                </Button>
              </Group>
            </Stack>
          )}
        </Paper>
      </Group>
    </Stack>
  );
}

function EngineSettings({
  selected,
  setSelected,
}: { selected: number; setSelected: (v: number | null) => void }) {
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

  useEffect(() => {
    if (options) {
      const settings = [...(engine.settings || [])];
      const missing = requiredEngineSettings.filter(
        (field) => !settings.find((setting) => setting.name === field),
      );
      for (const field of requiredEngineSettings) {
        if (!settings.find((setting) => setting.name === field)) {
          const option = options.options.find(
            (option) => option.value.name === field,
          );
          if (option) {
            // @ts-ignore
            settings.push({ name: field, value: option.value.default });
          }
        }
      }
      if (missing.length > 0) {
        setEngine({ ...engine, settings });
      }
    }
  }, [options]);

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
    if (value !== def || requiredEngineSettings.includes(name)) {
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

  const [deleteModal, toggleDeleteModal] = useToggle();
  const [jsonModal, toggleJSONModal] = useToggle();

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
        <Divider variant="dashed" label="Search settings" />
        <GoModeInput
          goMode={engine.go || null}
          setGoMode={(v) => setEngine({ ...engine, go: v })}
        />

        <Divider variant="dashed" label="Advanced settings" />
        <SimpleGrid cols={2}>
          {completeOptions
            .filter((option: { type: string }) => option.type !== "check")
            .map((option: any) => {
              return match(option)
                .with({ type: "spin", value: P.select() }, (v: any) => {
                  return (
                    <NumberInput
                      key={v.name}
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
                      key={v.name}
                      label={v.name}
                      data={v.var}
                      value={v.value}
                      onChange={(e) => setSetting(v.name, e, v.default)}
                    />
                  );
                })
                .with({ type: "string", value: P.select() }, (v: any) => {
                  if (v.name.toLowerCase().includes("file")) {
                    const file = v.value ? new File([v.value], v.value) : null;
                    return (
                      <FileInput
                        key={v.name}
                        clearable
                        label={v.name}
                        value={file}
                        onClick={async () => {
                          const selected = await open({
                            multiple: false,
                          });
                          if (!selected) return;
                          setSetting(v.name, selected as string, v.default);
                        }}
                        onChange={(e) => {
                          if (e === null) {
                            setSetting(v.name, null, v.default);
                          }
                        }}
                      />
                    );
                  }
                  return (
                    <TextInput
                      key={v.name}
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
                  key={o.value.name}
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

        <Group justify="end">
          <Button variant="default" onClick={() => toggleJSONModal(true)}>
            Edit JSON
          </Button>
          <Button
            variant="default"
            onClick={() =>
              setEngine({
                ...engine,
                settings: options?.options
                  .filter((option) =>
                    requiredEngineSettings.includes(option.value.name),
                  )
                  .map((option) => ({
                    name: option.value.name,
                    // @ts-ignore
                    value: option.value.default,
                  })),
              })
            }
          >
            Reset to default
          </Button>
          <Button color="red" onClick={() => toggleDeleteModal()}>
            Remove
          </Button>
        </Group>
        <ConfirmModal
          title={"Remove Engine"}
          description={
            "Are you sure you want to remove this engine from En Croissant?"
          }
          opened={deleteModal}
          onClose={toggleDeleteModal}
          onConfirm={() => {
            setEngines(async (prev) =>
              (await prev).filter((e) => e.name !== engine.name),
            );
            setSelected(null);
            toggleDeleteModal();
          }}
          confirmLabel="Remove"
        />
      </Stack>
      <JSONModal
        key={engine.name}
        opened={jsonModal}
        toggleOpened={toggleJSONModal}
        engine={engine}
        setEngine={(v) =>
          setEngines(async (prev) => {
            const copy = [...(await prev)];
            copy[selected] = v;
            return copy;
          })
        }
      />
    </ScrollArea>
  );
}

function JSONModal({
  opened,
  toggleOpened,
  engine,
  setEngine,
}: {
  opened: boolean;
  toggleOpened: () => void;
  engine: Engine;
  setEngine: (v: Engine) => void;
}) {
  const [value, setValue] = useState(JSON.stringify(engine, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal opened={opened} onClose={toggleOpened} title="Edit JSON" size="xl">
      <JsonInput
        autosize
        value={value}
        onChange={(e) => {
          setValue(e);
          setError(null);
        }}
        error={error}
      />
      <Space h="md" />
      <Button
        onClick={() => {
          const parseRes = engineSchema.safeParse(JSON.parse(value));
          if (parseRes.success) {
            setEngine(parseRes.data);
            setError(null);
            toggleOpened();
          } else {
            setError("Invalid Configuration"); // TODO: show better error message
          }
        }}
      >
        Save
      </Button>
    </Modal>
  );
}

function EngineName({ engine }: { engine: Engine }) {
  const { data: fileExists, isLoading } = useSWRImmutable(
    ["file-exists", engine.type === "local" ? engine.path : null],
    async ([, path]) => {
      if (path === null) return false;
      if (engine.type !== "local") return true;
      const res = await commands.fileExists(path);
      return res.status === "ok";
    },
  );

  const hasError = engine.type === "local" && !isLoading && !fileExists;

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
