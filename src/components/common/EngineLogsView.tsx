import type { EngineLog } from "@/bindings";
import { fontSizeAtom } from "@/state/atoms";
import {
  ActionIcon,
  Group,
  ScrollArea,
  SegmentedControl,
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

export type LogsFilter = "all" | "gui" | "engine";

interface EngineLogsViewProps {
  logs: EngineLog[];
  onRefresh?: () => void;
  height?: number | string;
  showExport?: boolean;
  virtualized?: boolean;
  additionalControls?: React.ReactNode;
}

export default function EngineLogsView({
  logs,
  onRefresh,
  height,
  showExport = true,
  virtualized = true,
  additionalControls,
}: EngineLogsViewProps) {
  const [filter, setFilter] = useState<LogsFilter>("all");
  const viewportRef = useRef<HTMLDivElement>(null);
  const fontSize = useAtomValue(fontSizeAtom);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (filter === "all") return true;
        if (filter === "gui") return log.type === "gui";
        if (filter === "engine") return log.type === "engine";
        return true;
      }),
    [logs, filter],
  );

  const logsLength = logs.length;
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
      });
    }
  }, [logsLength]);

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
    estimateSize: () => 35 * (fontSize / 100),
    getScrollElement: () => viewportRef.current,
  });

  return (
    <Stack flex={1} h="100%" gap="xs">
      <Group>
        <ActionIcon.Group style={{ flexGrow: 0 }}>
          {onRefresh && (
            <ActionIcon size="lg" variant="default" onClick={onRefresh}>
              <IconRefresh size="1.3rem" />
            </ActionIcon>
          )}
          {showExport && (
            <ActionIcon size="lg" variant="default" onClick={exportLogs}>
              <IconFileExport size="1.3rem" />
            </ActionIcon>
          )}
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

        {additionalControls}
      </Group>

      {filteredLogs.length === 0 ? (
        <Text ta="center" mt="lg" c="dimmed">
          No logs available
        </Text>
      ) : virtualized ? (
        <ScrollArea
          flex={height ? undefined : 1}
          h={height}
          viewportRef={viewportRef}
        >
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
                <LogLine log={filteredLogs[virtualRow.index]} />
              </Table.Tr>
            ))}
          </Table>
        </ScrollArea>
      ) : (
        <ScrollArea
          flex={height ? undefined : 1}
          h={height}
          viewportRef={viewportRef}
        >
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="5rem">Source</Table.Th>
                <Table.Th>Message</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredLogs.map((log, index) => (
                <Table.Tr key={index}>
                  <LogLine log={log} />
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  );
}

function LogLine({ log }: { log: EngineLog }) {
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
