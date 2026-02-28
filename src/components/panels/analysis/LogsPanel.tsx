import { Select, Stack } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useState } from "react";
import useSWR from "swr";
import { commands } from "@/bindings";
import { activeTabAtom, enginesAtom } from "@/state/atoms";
import { isLocalEngine, type LocalEngine } from "@/utils/engines";
import { unwrap } from "@/utils/unwrap";
import EngineLogsView from "../../common/EngineLogsView";

export default function LogsPanel() {
  const engines = useAtomValue(enginesAtom);
  const localEngines = (engines ?? [])
    .filter(isLocalEngine)
    .filter((e) => e.loaded);
  const [engine, setEngine] = useState<LocalEngine | undefined>(
    localEngines[0],
  );

  const activeTab = useAtomValue(activeTabAtom);
  const { data, mutate } = useSWR(["logs", engine?.id, activeTab], async () => {
    return engine
      ? unwrap(await commands.getEngineLogs(engine.id, activeTab!))
      : undefined;
  });

  return (
    <Stack flex={1} h="100%">
      <EngineLogsView
        logs={data ?? []}
        onRefresh={() => mutate()}
        additionalControls={
          <Select
            allowDeselect={false}
            value={engine?.id ?? ""}
            onChange={(id) => setEngine(localEngines.find((e) => e.id === id))}
            data={localEngines.map((e) => ({ value: e.id, label: e.name }))}
          />
        }
      />
    </Stack>
  );
}
