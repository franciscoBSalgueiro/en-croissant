import {
  ActionIcon,
  Button,
  Center,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Input,
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
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconCloud,
  IconCopy,
  IconCpu,
  IconFolder,
  IconPhotoPlus,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { platform } from "@tauri-apps/plugin-os";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { match, P } from "ts-pattern";
import { commands } from "@/bindings";
import { Route } from "@/routes/engines";
import { enginesAtom } from "@/state/atoms";
import {
  type Engine,
  engineSchema,
  type LocalEngine,
  requiredEngineSettings,
} from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";
import ConfirmModal from "../common/ConfirmModal";
import GenericCard from "../common/GenericCard";
import GoModeInput from "../common/GoModeInput";
import LocalImage from "../common/LocalImage";
import OpenFolderButton from "../common/OpenFolderButton";
import LinesSlider from "../panels/analysis/LinesSlider";
import AddEngine from "./AddEngine";

export default function EnginesPage() {
  const { t } = useTranslation();

  const [engines, setEngines] = useAtom(enginesAtom);
  const enginesList = useMemo(() => engines ?? [], [engines]);
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const { selected } = Route.useSearch();
  const navigate = useNavigate();
  const setSelected = (v: number | null) => {
    navigate({ to: "/engines", search: { selected: v ?? undefined } });
  };

  const selectedEngine = selected !== undefined ? enginesList[selected] : null;
  const filteredEngines = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const indexedEngines = enginesList.map((item, index) => ({ item, index }));

    if (!normalizedSearch) {
      return indexedEngines;
    }

    return indexedEngines.filter(({ item }) => {
      const values = [
        item.name,
        item.id,
        item.type,
        item.type === "local" ? item.path : "",
        item.type === "local" ? (item.version ?? "") : "",
        item.type === "local" && item.elo ? item.elo.toString() : "",
      ];

      return values.some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [enginesList, search]);
  const hasSearch = search.trim().length > 0;
  const hasEngines = enginesList.length > 0;

  return (
    <Stack h="100%">
      <AddEngine opened={opened} setOpened={setOpened} />
      <Group align="baseline" py="sm" pl="lg">
        <Title>{t("Engines.Title")}</Title>
        <OpenFolderButton base="Engines" folder="engines" />
      </Group>
      <Group grow flex={1} style={{ overflow: "hidden" }} align="start" px="md" pb="md">
        <Paper withBorder style={{ borderWidth: 2 }} h="100%">
          <Stack gap={0} h="100%" style={{ overflow: "hidden" }}>
            <Group p="xs" gap="xs">
              <Input
                size="sm"
                style={{ flexGrow: 1 }}
                leftSection={<IconSearch size="1rem" />}
                placeholder={t("Common.Search")}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <Tooltip label={t("Common.AddNew")}>
                <ActionIcon variant="default" size="lg" onClick={() => setOpened(true)}>
                  <IconPlus size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Divider />
            <ScrollArea flex={1}>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "md", md: "sm" }} p="xs">
                {filteredEngines.map(({ item, index }) => {
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
                      label: t("Common.Version"),
                      value: item.version,
                    });
                  }
                  return (
                    <GenericCard
                      id={index}
                      key={item.id}
                      isSelected={selected === index}
                      setSelected={setSelected}
                      error={undefined}
                      Header={<EngineName engine={item} />}
                      stats={stats}
                    />
                  );
                })}
              </SimpleGrid>
            </ScrollArea>
            {filteredEngines.length === 0 && (
              <Center h="100%">
                <Stack align="center" gap="sm">
                  <ThemeIcon size={64} radius="100%" variant="light" color="gray">
                    <IconCpu size={32} />
                  </ThemeIcon>
                  <Text c="dimmed" fw={500} ta="center">
                    {hasSearch ? t("Common.NoResults") : t("Engines.Empty.NoInstalled")}
                  </Text>
                  {!hasSearch && !hasEngines && (
                    <Text c="dimmed" size="sm" ta="center">
                      {t("Engines.Empty.AddHint")}
                    </Text>
                  )}
                </Stack>
              </Center>
            )}
          </Stack>
        </Paper>
        {!selectedEngine || selected === undefined ? (
          <Paper withBorder style={{ borderWidth: 2 }} p="md" h="100%">
            <Center h="100%">
              <Stack align="center" gap="sm">
                <ThemeIcon size={80} radius="100%" variant="light" color="gray">
                  <IconCpu size={40} />
                </ThemeIcon>
                <Text c="dimmed" fw={500} size="lg">
                  {t("Engines.Settings.NoEngine")}
                </Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <Paper withBorder style={{ borderWidth: 2 }} p="md" h="100%">
            {selectedEngine.type === "local" ? (
              <EngineSettings selected={selected} setSelected={setSelected} />
            ) : (
              <Stack>
                <Divider variant="dashed" label={t("Common.GeneralSettings")} />

                <TextInput
                  w="50%"
                  label={t("Common.Name")}
                  value={selectedEngine.name}
                  onChange={(e) => {
                    setEngines(async (prev) => {
                      const copy = [...(await prev)];
                      copy[selected].name = e.currentTarget.value;
                      return copy;
                    });
                  }}
                />

                <Divider variant="dashed" label={t("Engines.Settings.AdvancedSettings")} />
                <Stack w="50%">
                  <Text fw="bold">{t("Engines.Settings.NumOfLines")}</Text>
                  <LinesSlider
                    value={
                      Number(
                        selectedEngine.settings?.find(
                          (setting: { name: string }) => setting.name === "MultiPV",
                        )?.value,
                      ) || 1
                    }
                    setValue={(v) => {
                      setEngines(async (prev) => {
                        const copy = [...(await prev)];
                        const engine = copy[selected];
                        const settings = (engine.settings ?? []) as {
                          name: string;
                          value: string | number | boolean | null;
                        }[];
                        const settingIndex = settings.findIndex(
                          (setting: { name: string }) => setting.name === "MultiPV",
                        );
                        const nextSettings =
                          settingIndex >= 0
                            ? settings.map(
                                (
                                  setting: {
                                    name: string;
                                    value: string | number | boolean | null;
                                  },
                                  index: number,
                                ) => (index === settingIndex ? { ...setting, value: v } : setting),
                              )
                            : [
                                ...settings,
                                {
                                  name: "MultiPV",
                                  value: v,
                                },
                              ];
                        copy[selected] = {
                          ...engine,
                          settings: nextSettings,
                        };
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
                    {t("Common.Remove")}
                  </Button>
                </Group>
              </Stack>
            )}
          </Paper>
        )}
      </Group>
    </Stack>
  );
}

function EngineSettings({
  selected,
  setSelected,
}: {
  selected: number;
  setSelected: (v: number | null) => void;
}) {
  const { t } = useTranslation();

  const [engines, setEngines] = useAtom(enginesAtom);
  const engine = engines![selected] as LocalEngine;
  const { data: options } = useSWRImmutable(["engine-config", engine.path], async ([, path]) => {
    return unwrap(await commands.getEngineConfig(path));
  });

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
          const option = options.options.find((option) => option.value.name === field);
          if (option && option.type !== "button") {
            settings.push({
              name: field,
              value: option.value.default as string | number | boolean | null,
            });
          }
        }
      }
      if (missing.length > 0) {
        setEngine({ ...engine, settings });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const completeOptions =
    options?.options
      .filter((option) => option.type !== "button")
      .map((option) => {
        const setting = engine.settings?.find((setting) => setting.name === option.value.name);
        return {
          ...option,
          value: {
            ...option.value,
            value: setting?.value !== undefined ? setting.value : option.value.default,
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
  const syzygyPathSeparator = platform() === "windows" ? ";" : ":";

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label={t("Common.GeneralSettings")} />
        <Group grow align="start" wrap="nowrap">
          <Stack>
            <Group wrap="nowrap" w="100%">
              <TextInput
                flex={1}
                label={t("Common.Name")}
                value={engine.name}
                onChange={(e) => setEngine({ ...engine, name: e.currentTarget.value })}
              />
              <TextInput
                label={t("Common.Version")}
                w="5rem"
                value={engine.version}
                placeholder="?"
                onChange={(e) => setEngine({ ...engine, version: e.currentTarget.value })}
              />
            </Group>
            <Group grow>
              <NumberInput
                label="ELO"
                value={engine.elo || undefined}
                min={0}
                placeholder={t("Common.Unknown")}
                onChange={(v) =>
                  setEngine({
                    ...engine,
                    elo: typeof v === "number" ? v : undefined,
                  })
                }
              />
            </Group>
          </Stack>
          <Center>
            {engine.image ? (
              <Paper withBorder style={{ cursor: "pointer" }} onClick={changeImage}>
                <LocalImage
                  src={engine.image}
                  alt={engine.name}
                  mah="10rem"
                  maw="100%"
                  fit="contain"
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
        <Divider variant="dashed" label={t("Engines.Settings.SearchSettings")} />
        <GoModeInput
          goMode={engine.go ?? null}
          setGoMode={(v) => setEngine({ ...engine, go: v })}
        />

        <Divider variant="dashed" label={t("Engines.Settings.AdvancedSettings")} />
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
                  if (v.name.toLowerCase() === "syzygypath") {
                    return (
                      <Group key={v.name} align="end" wrap="nowrap">
                        <TextInput
                          flex={1}
                          label={v.name}
                          placeholder={`/path/to/tb${syzygyPathSeparator}/path/to/tb2`}
                          value={v.value || ""}
                          onChange={(e) => setSetting(v.name, e.currentTarget.value, v.default)}
                        />
                        <Button
                          variant="default"
                          leftSection={<IconFolder size="1rem" />}
                          onClick={async () => {
                            const selected = await open({
                              multiple: true,
                              directory: true,
                            });
                            if (!selected) return;

                            const directories = Array.isArray(selected) ? selected : [selected];
                            setSetting(v.name, directories.join(syzygyPathSeparator), v.default);
                          }}
                        >
                          {t("Common.Open")}
                        </Button>
                      </Group>
                    );
                  }
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
                      onChange={(e) => setSetting(v.name, e.currentTarget.value, v.default)}
                    />
                  );
                })
                .otherwise(() => null);
            })}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          {completeOptions
            .filter((option) => option.type === "check")
            .map((o) => {
              return (
                <Checkbox
                  key={o.value.name}
                  label={o.value.name}
                  checked={!!o.value.value}
                  disabled={o.value.name === "UCI_Chess960"}
                  onChange={(e) =>
                    setSetting(o.value.name, e.currentTarget.checked, o.value.default as boolean)
                  }
                />
              );
            })}
        </SimpleGrid>

        <Group justify="end">
          <Button variant="default" onClick={() => toggleJSONModal(true)}>
            {t("Engines.Settings.EditJSON")}
          </Button>
          <Button
            variant="default"
            onClick={() =>
              setEngine({
                ...engine,
                settings: options?.options
                  .filter((option) => requiredEngineSettings.includes(option.value.name))
                  .filter((option) => option.type !== "button")
                  .map((option) => ({
                    name: option.value.name,
                    value: option.value.default as string | number | boolean | null,
                  })),
              })
            }
          >
            {t("Engines.Settings.Reset")}
          </Button>
          <Button
            leftSection={<IconCopy size="1rem" />}
            variant="default"
            onClick={() => {
              const duplicatedEngine: LocalEngine = {
                ...engine,
                id: crypto.randomUUID(),
                name: `${engine.name} (Copy)`,
              };
              setEngines(async (prev) => {
                const copy = [...(await prev)];
                copy.splice(selected + 1, 0, duplicatedEngine);
                return copy;
              });
              setSelected(selected + 1);
            }}
          >
            {t("Common.Duplicate")}
          </Button>
          <Button color="red" onClick={() => toggleDeleteModal()}>
            {t("Common.Remove")}
          </Button>
        </Group>
        <ConfirmModal
          title={t("Engines.Remove.Title")}
          description={t("Engines.Remove.Message")}
          opened={deleteModal}
          onClose={toggleDeleteModal}
          onConfirm={() => {
            setEngines(async (prev) => (await prev).filter((e) => e.name !== engine.name));
            setSelected(null);
            toggleDeleteModal();
          }}
          confirmLabel={t("Common.Remove")}
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
  const { t } = useTranslation();

  const [value, setValue] = useState(JSON.stringify(engine, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal opened={opened} onClose={toggleOpened} title={t("Engines.Settings.EditJSON")} size="xl">
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
        {t("Common.Save")}
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
        <LocalImage src={engine.image} alt={engine.name} h="2.5rem" fit="contain" flex={0} />
      ) : engine.type !== "local" ? (
        <IconCloud size="2.5rem" />
      ) : (
        <IconCpu size="2.5rem" />
      )}
      <Stack gap={0}>
        <Text fw="bold" lineClamp={1} c={hasError ? "red" : undefined}>
          {engine.name} {hasError ? "(file missing)" : ""}
        </Text>
        <Text size="xs" c="dimmed" style={{ wordWrap: "break-word" }} lineClamp={1}>
          {engine.type === "local" ? engine.path.split(/\/|\\/).slice(-1)[0] : engine.url}
        </Text>
      </Stack>
    </Group>
  );
}
