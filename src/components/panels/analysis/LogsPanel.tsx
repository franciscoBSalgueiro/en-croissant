import { commands } from "@/bindings";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";
import { Select, Stack } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useState } from "react";
import useSWR from "swr";
import EngineLogsView from "../../common/EngineLogsView";

export default function LogsPanel() {
  const engines = useAtomValue(enginesAtom);
  const localEngines = engines
    .filter((e): e is LocalEngine => e.type === "local")
    .filter((e) => e.loaded);
  const [engine, setEngine] = useState<LocalEngine | undefined>(
    localEngines[0],
  );

  const activeTab = useAtomValue(activeTabAtom);
  const { data, mutate } = useSWR(
    ["logs", engine?.path, activeTab],
    async () => {
      return engine
        ? unwrap(await commands.getEngineLogs(engine.path, activeTab!))
        : undefined;
    },
  );

  return (
    <Stack flex={1} h="100%">
      <EngineLogsView
        logs={data ?? []}
        onRefresh={() => mutate()}
        additionalControls={
          <Select
            allowDeselect={false}
            value={engine?.name ?? "No engines loaded"}
            onChange={(name) =>
              setEngine(localEngines.find((e) => e.name === name))
            }
            data={localEngines.map((e) => ({ value: e.name, label: e.name }))}
          />
        }
      />
    </Stack>
  );
}
