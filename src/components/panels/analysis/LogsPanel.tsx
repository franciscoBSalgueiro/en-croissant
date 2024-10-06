import { commands } from "@/bindings";
import { activeTabAtom, enginesAtom, fontSizeAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";
import {
  ActionIcon,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconFileExport, IconRefresh } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

export default function LogsPanel() {
  const engines = useAtomValue(enginesAtom);
  const localEngines = engines
    .filter((e): e is LocalEngine => e.type === "local")
    .filter((e) => e.loaded);
  const [engine, setEngine] = useState<LocalEngine | undefined>(
    localEngines[0],
  );

  const viewport = useRef<HTMLDivElement>(null);
  const activeTab = useAtomValue(activeTabAtom);
  const { data, mutate } = useSWR(
    ["logs", engine?.path, activeTab],
    async () => {
      return engine
        ? unwrap(await commands.getEngineLogs(engine.path, activeTab!))
        : undefined;
    },
  );

  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({
        top: viewport.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [data?.length, mutate]);

  const [filter, setFilter] = useState<"gui" | "engine" | "all">("all");
  const filteredData = useMemo(
    () =>
      data?.filter((line) => {
        if (filter === "all") return true;
        if (filter === "gui") return line.type === "gui";
        if (filter === "engine") return line.type === "engine";
      }),
    [data, filter],
  );

  async function exportLogs() {
    const file = await save({ defaultPath: "logs.csv" });
    const content = data
      ?.map((line) => `${line.type}, ${line.value.trimEnd()}`)
      .join("\n");
    if (file) {
      await writeTextFile(file, content ?? "");
    }
  }

  const fontSize = useAtomValue(fontSizeAtom);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData?.length || 0,
    estimateSize: () => 35 * (fontSize / 100),
    getScrollElement: () => parentRef.current!,
  });

  return (
    <Stack flex={1} h="100%">
      <Group grow>
        <ActionIcon.Group style={{ flexGrow: 0 }}>
          <ActionIcon size="lg" variant="default" onClick={() => mutate()}>
            <IconRefresh size="1.3rem" />
          </ActionIcon>
          <ActionIcon size="lg" variant="default" onClick={exportLogs}>
            <IconFileExport size="1.3rem" />
          </ActionIcon>
        </ActionIcon.Group>

        <SegmentedControl
          fullWidth
          value={filter}
          onChange={(value) => setFilter(value as any)}
          data={[
            { value: "all", label: "All" },
            { value: "gui", label: "GUI" },
            { value: "engine", label: "Engine" },
          ]}
        />
        <Select
          allowDeselect={false}
          value={engine?.name ?? "No engines loaded"}
          onChange={(name) =>
            setEngine(localEngines.find((e) => e.name === name))
          }
          data={localEngines.map((e) => ({ value: e.name, label: e.name }))}
        />
      </Group>

      {filteredData?.length === 0 && (
        <Text ta="center" mt="lg">
          No logs for {engine?.name ?? "engine"}
        </Text>
      )}
      <ScrollArea flex={1} viewportRef={parentRef}>
        <Table
          withTableBorder
          withColumnBorders
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <Table.Tr
              key={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <LogLine log={filteredData![virtualRow.index]} />
            </Table.Tr>
          ))}
        </Table>
      </ScrollArea>
    </Stack>
  );
}

type Log = { type: "gui"; value: string } | { type: "engine"; value: string };
function LogLine({ log }: { log: Log }) {
  return (
    <>
      <Table.Td w="5rem">{log.type.toUpperCase()}</Table.Td>
      <Table.Td>
        <Text lineClamp={1} fz="xs">
          {log.value}
        </Text>
      </Table.Td>
    </>
  );
}
