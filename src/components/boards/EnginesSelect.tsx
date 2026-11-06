import { Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { enginesAtom } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import { BUILTIN_STOCKFISH_ID } from "@/utils/stockfish";

export function EnginesSelect({
  engine,
  setEngine,
  builtin = false,
  setBuiltin,
}: {
  engine: LocalEngine | null;
  setEngine: (engine: LocalEngine | null) => void;
  /** The built-in Stockfish 19 is selected. */
  builtin?: boolean;
  /** When given, the built-in Stockfish 19 is offered as an option. */
  setBuiltin?: () => void;
}) {
  const allEngines = useAtomValue(enginesAtom);
  const engines = (allEngines ?? []).filter((e): e is LocalEngine => e.type === "local");

  useEffect(() => {
    if (builtin) return;
    if (engine === null) {
      if (engines.length > 0) setEngine(engines[0]);
      else setBuiltin?.();
    } else {
      const updatedEngine = engines.find((e) => e.id === engine.id);
      if (updatedEngine && updatedEngine !== engine) {
        setEngine(updatedEngine);
      }
    }
  }, [engine, engines, setEngine, builtin, setBuiltin]);

  const data = [
    ...(setBuiltin ? [{ label: "Stockfish 19", value: BUILTIN_STOCKFISH_ID }] : []),
    ...engines.map((engine) => ({
      label: engine.name,
      value: engine.id,
    })),
  ];

  return (
    <Select
      allowDeselect={false}
      data={data}
      value={builtin ? BUILTIN_STOCKFISH_ID : (engine?.id ?? "")}
      onChange={(e) => {
        if (e === BUILTIN_STOCKFISH_ID) {
          setBuiltin?.();
        } else {
          setEngine(engines.find((engine) => engine.id === e) ?? null);
        }
      }}
    />
  );
}
