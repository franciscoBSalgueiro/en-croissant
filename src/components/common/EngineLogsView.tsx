import type { EngineLog } from "@/bindings";
import { fontSizeAtom } from "@/state/atoms";
import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconFileExport,
  IconFilter,
  IconRefresh,
  IconTerminal2,
} from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";

export type LogsFilter = "all" | "gui" | "engine";

interface EngineLogsViewProps {
  logs: EngineLog[];
  onRefresh?: () => void;
  additionalControls?: React.ReactNode;
}

export default function EngineLogsView({
  logs,
  onRefresh,
  additionalControls,
}: EngineLogsViewProps) {
  const [filter, setFilter] = useState<LogsFilter>("all");
  const [search, setSearch] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const fontSize = useAtomValue(fontSizeAtom);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (filter === "gui" && log.type !== "gui") return false;
        if (filter === "engine" && log.type !== "engine") return false;
        if (search && !log.value.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [logs, filter, search],
  );

  useEffect(() => {
    if (viewportRef.current && !search) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
      });
    }
  }, [logs.length, search]);

  async function exportLogs() {
    const file = await save({ defaultPath: "logs.csv" });
    const content = logs
      .map((line) => `${line.type}, ${line.value.trimEnd()}`)
      .join("\n");
    if (file) {
      await writeTextFile(file, content);
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    estimateSize: () => 30 * (fontSize / 100),
    getScrollElement: () => viewportRef.current,
  });

  return (
    <Stack flex={1} h="100%" gap={0}>
      <Group w="100%" gap="xs" wrap="nowrap" pr="sm">
        <ActionIcon.Group style={{ flexShrink: 0 }}>
          {onRefresh && (
            <Tooltip label="Refresh logs">
              <ActionIcon size="lg" variant="default" onClick={onRefresh}>
                <IconRefresh size="1.1rem" />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Export logs">
            <ActionIcon size="lg" variant="default" onClick={exportLogs}>
              <IconFileExport size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        </ActionIcon.Group>

        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as LogsFilter)}
          data={[
            { value: "all", label: "All" },
            { value: "gui", label: "GUI" },
            { value: "engine", label: "Engine" },
          ]}
        />

        <TextInput
          placeholder="Filter logs..."
          leftSection={<IconFilter size="0.9rem" />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flexGrow: 1, minWidth: 0 }}
        />

        {additionalControls}
      </Group>
      <Divider mt="sm" />

      {filteredLogs.length === 0 ? (
        <Stack align="center" justify="center" flex={1} gap="xs">
          <IconTerminal2 size="2.5rem" opacity={0.3} />
          <Text ta="center" c="dimmed" fz="sm">
            {logs.length === 0
              ? "No logs available yet"
              : "No logs match the current filter"}
          </Text>
        </Stack>
      ) : (
        <ScrollArea flex={1} viewportRef={viewportRef}>
          <Box
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
              fontFamily: "monospace",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <LogLine
                key={virtualRow.index}
                log={filteredLogs[virtualRow.index]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            ))}
          </Box>
        </ScrollArea>
      )}
    </Stack>
  );
}

function LogLine({
  log,
  style,
}: {
  log: EngineLog;
  style: React.CSSProperties;
}) {
  const isGui = log.type === "gui";
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      align="center"
      px="xs"
      style={{
        ...style,
        borderBottom: "1px solid var(--mantine-color-dark-5)",
      }}
    >
      <Badge
        variant="light"
        color={isGui ? "blue" : "teal"}
        w="3.5rem"
        style={{ flexShrink: 0 }}
      >
        {isGui ? "GUI" : "ENG"}
      </Badge>
      <Tooltip
        label={log.value.trim()}
        multiline
        maw={500}
        withArrow
        openDelay={400}
        styles={{ tooltip: { fontFamily: "monospace", fontSize: "0.75rem" } }}
      >
        <Text
          lineClamp={1}
          fz="xs"
          ff="monospace"
          c={isGui ? "blue.3" : "dimmed"}
          style={{ userSelect: "text", cursor: "default" }}
        >
          {log.value.trim()}
        </Text>
      </Tooltip>
    </Group>
  );
}
