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
  Image,
  NumberInput,
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
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtomValue } from "jotai";
import { useState } from "react";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import useSWRImmutable from "swr/immutable";

import GenericCard from "../common/GenericCard";
import * as classes from "@/components/common/GenericCard.css";
import { unwrap } from "@/utils/invoke";
import { commands } from "@/bindings";
import { P, match } from "ts-pattern";

export default function EnginesPage() {
  const engines = useAtomValue(enginesAtom);
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<Engine | null>(null);
  return (
    <Stack h="100%" px="lg" pb="lg">
      <AddEngine opened={opened} setOpened={setOpened} />
      <Group align="baseline" py="sm">
        <Title>Your Engines</Title>
        <OpenFolderButton base="AppDir" folder="engines" />
      </Group>
      {/* <DataTable<Engine>
        records={engines}
        withTableBorder
        highlightOnHover
        idAccessor="name"
        columns={[
          {
            title: "Engine",
            accessor: "name",
            render: (engine) => <EngineName engine={engine} />,
            footer: (
              <Button
                onClick={() => setOpened(true)}
                variant="default"
                rightSection={<IconPlus />}
              >
                Add new
              </Button>
            ),
          },
          {
            accessor: "elo",
          },
          {
            accessor: "actions",
            textAlign: "right",
            render: (name) => (
              <Group justify="right">
                <ActionIcon>
                  <IconEdit size="1.25rem" onClick={() => setOpened(true)} />
                </ActionIcon>
                <ActionIcon>
                  <IconX size="1.25rem" onClick={() => {}} />
                </ActionIcon>
              </Group>
            ),
          },
        ]}
        rowExpansion={{
          content: ({ record }) => (
            <Stack className={classes.details} p="xs" gap={6}>
              <Text>Engine details</Text>
              <Text>{record.name}</Text>
            </Stack>
          ),
        }}
      /> */}
      <Group
        grow
        flex={1}
        style={{ overflow: "hidden" }}
        align="start"
        px="md"
        pb="md"
      >
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: "md", md: "sm" }}
          >
            {engines.map((item) => (
              <GenericCard
                id={item}
                key={item.name}
                isSelected={selected?.name === item.name}
                setSelected={setSelected}
                error={undefined}
                Header={<EngineName engine={item} />}
                stats={
                  item.type === "local"
                    ? [
                        {
                          label: "ELO",
                          value: item.elo ? item.elo.toString() : "???",
                        },
                        {
                          label: "Version",
                          value: item.version,
                        },
                      ]
                    : [{ label: "Type", value: "Cloud" }]
                }
              />
            ))}
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
        {selected === null ? (
          <Text ta="center">No engine selected</Text>
        ) : selected.type === "local" ? (
          <EngineSettings engine={selected} key={selected.name} />
        ) : (
          <Stack>
            <Text ta="center" fw="bold" fz="lg">
              {selected.type === "lichess" ? "Lichess Cloud" : "ChessDB"}
            </Text>
            <Text>{selected.url}</Text>
          </Stack>
        )}
      </Group>
    </Stack>
  );
}

function EngineSettings({ engine }: { engine: LocalEngine }) {
  const { data: options } = useSWRImmutable(
    ["engine-config", engine.path],
    async ([, path]) => {
      const res = await commands.getEngineConfig(path);
      return unwrap(await commands.getEngineConfig(path));
    },
  );

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label="General settings" />
        <Group grow align="start" wrap="nowrap">
          <Stack>
            <Group wrap="nowrap" w="100%">
              <TextInput flex={1} label="Name" value={engine.name} />
              <TextInput
                label="Version"
                w="5rem"
                value={engine.version}
                placeholder="?"
              />
            </Group>
            <Group grow>
              <NumberInput
                label="ELO"
                value={engine.elo || undefined}
                min={0}
                placeholder="Unknown"
              />
            </Group>
            <Checkbox label="Enabled" checked={!!engine.loaded} />
          </Stack>
          <Center>
            {engine.image ? (
              <Image
                src={engine.image}
                alt={engine.name}
                mah="10rem"
                maw="100%"
              />
            ) : (
              <ActionIcon
                size="10rem"
                variant="subtle"
                styles={{
                  root: {
                    border: "1px dashed",
                  },
                }}
              >
                <IconPhotoPlus size="2.5rem" />
              </ActionIcon>
            )}
          </Center>
        </Group>
        <Divider variant="dashed" label="Advanced settings" />
        <SimpleGrid cols={2}>
          {options?.options
            .filter(
              (option) => option.type !== "check" && option.type !== "button",
            )
            .map((option) => {
              return match(option)
                .with({ type: "spin", value: P.select() }, (v) => {
                  return (
                    <NumberInput
                      label={v.name}
                      min={Number(v.min)}
                      max={Number(v.max)}
                      value={Number(v.default)}
                    />
                  );
                })
                .with({ type: "combo", value: P.select() }, (v) => {
                  return (
                    <Select label={v.name} data={v.var} value={v.default} />
                  );
                })
                .with({ type: "string", value: P.select() }, (v) => {
                  if (
                    v.name.toLowerCase().includes("file") ||
                    v.name.toLowerCase().includes("path")
                  ) {
                    const file = v.default
                      ? new File([v.default], v.default)
                      : null;
                    return <FileInput label={v.name} value={file} />;
                  }
                  return <TextInput label={v.name} value={v.default || ""} />;
                })
                .otherwise(() => null);
            })}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          {options?.options
            .filter((option) => option.type === "check")
            .map((option) => (
              <Checkbox
                label={option.value.name}
                /// @ts-ignore
                checked={!!option.value.default}
              />
            ))}
        </SimpleGrid>
      </Stack>
    </ScrollArea>
  );
}

function EngineName({ engine }: { engine: Engine }) {
  const { data: imageSrc } = useSWRImmutable(engine.image, async (image) => {
    if (image?.startsWith("http")) {
      return image;
    }
    if (image) {
      return await convertFileSrc(image);
    }
  });

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
      {imageSrc ? (
        <Image src={imageSrc} alt={engine.name} h="2.5rem" />
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
