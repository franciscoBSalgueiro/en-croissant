import { activeTabAtom, enginesAtom } from "@/atoms/atoms";
import { unwrap } from "@/utils/invoke";
import {
  Group,
  Text,
  SegmentedControl,
  ActionIcon,
  Table,
  Select,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { FixedSizeList } from "react-window";
import { commands } from "@/bindings";

export default function LogsPanel() {
  const engines = useAtomValue(enginesAtom);
  const [engine, setEngine] = useState(engines.filter((e) => e.loaded)[0]);

  const viewport = useRef<HTMLDivElement>(null);
  const activeTab = useAtomValue(activeTabAtom);
  const { data, mutate } = useSWR(
    ["logs", engine.path, activeTab],
    async () => {
      console.log("fetching logs");
      return unwrap(await commands.getEngineLogs(engine.path, activeTab!));
    }
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
    [data, filter]
  );

  return (
    <>
      <Group grow>
        <ActionIcon onClick={() => mutate()} sx={{ flexGrow: 0 }}>
          <IconRefresh />
        </ActionIcon>
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
          value={engine.name}
          onChange={(name: string) =>
            setEngine(engines.find((e) => e.name === name)!)
          }
          data={engines.map((e) => ({ value: e.name, label: e.name }))}
        />
      </Group>

      {filteredData?.length === 0 && (
        <Text align="center" mt="lg">
          No logs for {engine.name}
        </Text>
      )}
      <FixedSizeList
        itemCount={filteredData?.length || 0}
        itemSize={30}
        height={250}
        width={"100%"}
        innerElementType={Inner}
      >
        {({ index, style }) => (
          <tr style={style}>
            <LogLine log={filteredData![index]} />
          </tr>
        )}
      </FixedSizeList>
    </>
  );
}

const Inner = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  function Inner({ children, ...rest }, ref) {
    return (
      <div {...rest} ref={ref}>
        <Table>
          <tbody>{children}</tbody>
        </Table>
      </div>
    );
  }
);

type Log = { type: "gui"; value: string } | { type: "engine"; value: string };
function LogLine({ log }: { log: Log }) {
  return (
    <>
      <td>{log.type.toUpperCase()}</td>
      <td>
        <Text lineClamp={1} fz="xs">
          {log.value}
        </Text>
      </td>
    </>
  );
}
