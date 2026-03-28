import { Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { enginesAtom } from "@/state/atoms";
import { isLocalEngine, isMaiaEngine, type LocalEngine } from "@/utils/engines";

export function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: LocalEngine | null;
  setEngine: (engine: LocalEngine | null) => void;
}) {
  const allEngines = useAtomValue(enginesAtom);
  const engines = (allEngines ?? []).filter(isLocalEngine).filter((candidate) => !isMaiaEngine(candidate));

  useEffect(() => {
    if (engines.length === 0) {
      if (engine !== null) setEngine(null);
      return;
    }
    if (engine === null) {
      setEngine(engines[0]);
    } else {
      const updatedEngine = engines.find((e) => e.id === engine.id);
      if (!updatedEngine) {
        setEngine(engines[0]);
      } else if (updatedEngine !== engine) {
        setEngine(updatedEngine);
      }
    }
  }, [engine, engines, setEngine]);

  return (
    <Select
      allowDeselect={false}
      data={engines?.map((engine) => ({
        label: engine.name,
        value: engine.id,
      }))}
      value={engine?.id ?? ""}
      onChange={(e) => {
        setEngine(engines.find((engine) => engine.id === e) ?? null);
      }}
    />
  );
}
