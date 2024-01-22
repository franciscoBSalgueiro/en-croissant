import { activeTabAtom, enginesAtom } from "@/atoms/atoms";
import { commands } from "@/bindings";
import VirtualizedScrollArea from "@/components/common/VirtualizedScrollArea";
import { LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/invoke";
import {
  ActionIcon,
  Box,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconFileExport, IconRefresh } from "@tabler/icons-react";
import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
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
      <Box w="100%" flex={1}>
        <VirtualizedScrollArea
          itemCount={filteredData?.length || 0}
          itemSize={30}
          innerElementType={Inner}
        >
          {({ index, style }) => (
            <Table.Tr style={style}>
              <LogLine log={filteredData?.[index]} />
            </Table.Tr>
          )}
        </VirtualizedScrollArea>
      </Box>
    </Stack>
  );
}

const Inner = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  function Inner({ children, ...rest }, ref) {
    return (
      <div {...rest} ref={ref}>
        <Table>
          <Table.Tbody>{children}</Table.Tbody>
        </Table>
      </div>
    );
  },
);

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
