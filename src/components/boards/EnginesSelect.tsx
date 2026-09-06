import { Select } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { enginesAtom } from "@/state/atoms";
import { requiredEngineSettings, type LocalEngine } from "@/utils/engines";
import useSWRImmutable from "swr/immutable";
import { commands } from "@/bindings";
import { unwrap } from "@/utils/unwrap";

export function EnginesSelect({
  engine,
  setEngine,
}: {
  engine: LocalEngine | null;
  setEngine: (engine: LocalEngine | null) => void;
}) {
  const [allEngines, setAllEngines] = useAtom(enginesAtom);
  const engines = (allEngines ?? []).filter((e): e is LocalEngine => e.type === "local");
  const { data: options } = useSWRImmutable(["engine-config", engine?.path], async ([, path]) => {
    return unwrap(await commands.getEngineConfig(String(path)));
  });
  useEffect(() => {
    if (options && engine) {
      const settings = [...(engine.settings || [])];
      const missing = requiredEngineSettings.filter(
        (field) => !settings.find((setting) => setting.name === field),
      );
      for (const field of requiredEngineSettings) {
        if (!settings.find((setting) => setting.name === field)) {
          const option = options.options.find((option) => option.value.name === field);
          if (option && option.type !== "button") {
            if (option.type == "spin") {
              settings.push({
                name: field,
                value: option.value.default as string | number | boolean | null,
                min: option.value.min as number | null,
                max: option.value.max as number | null,
              });
            } else {
              settings.push({
                name: field,
                value: option.value.default as string | number | boolean | null,
              });
            }
          }
        }
      }
      if (missing.length > 0 && allEngines) {
        const newEngine = { ...engine, settings };
        setAllEngines(async (prev) => {
          const copy = [...(await prev)];
          copy[allEngines.findIndex((o) => o == engine)] = newEngine;
          return copy;
        });
      }
    }
  }, [options]);

  useEffect(() => {
    if (engines.length === 0) return;
    if (engine === null) {
      setEngine(engines[0]);
    } else {
      const updatedEngine = engines.find((e) => e.id === engine.id);
      if (updatedEngine && updatedEngine !== engine) {
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
