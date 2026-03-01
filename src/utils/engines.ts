import { fetch } from "@tauri-apps/plugin-http";
import type { Platform } from "@tauri-apps/plugin-os";
import useSWR from "swr";
import { z } from "zod";
import {
  type BestMoves,
  commands,
  type EngineOptions,
  type GoMode,
} from "@/bindings";
import { unwrap } from "./unwrap";

export const requiredEngineSettings = ["MultiPV", "Threads", "Hash"];

const goModeSchema: z.ZodType<GoMode> = z.union([
  z.object({
    t: z.literal("Depth"),
    c: z.number(),
  }),
  z.object({
    t: z.literal("Time"),
    c: z.number(),
  }),
  z.object({
    t: z.literal("Nodes"),
    c: z.number(),
  }),
  z.object({
    t: z.literal("Infinite"),
  }),
]);

const engineSettingsSchema = z.array(
  z.object({
    name: z.string(),
    value: z.string().or(z.number()).or(z.boolean()).nullable(),
  }),
);

export type EngineSettings = z.infer<typeof engineSettingsSchema>;

const localEngineBaseSchema = z.object({
  type: z.literal("local"),
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string(),
  version: z.string(),
  path: z.string(),
  image: z.string().nullish(),
  elo: z.number().nullish(),
  downloadSize: z.number().nullish(),
  downloadLink: z.string().nullish(),
  loaded: z.boolean().nullish(),
  enabled: z.boolean().nullish(),
  settings: engineSettingsSchema.nullish(),
});

const localUciEngineSchema = z.object({
  ...localEngineBaseSchema.shape,
  runtime: z.literal("uci"),
  go: goModeSchema.optional(),
});
export type LocalUciEngine = z.output<typeof localUciEngineSchema>;
const localMaiaEngineSchema = z.object({
  ...localEngineBaseSchema.shape,
  runtime: z.literal("maia"),
  // maia does not support time control. Put null field here to make accessing localEngine's goMode when needed easier.
  // Also in case future ONNX models supports time control
  go: z.null(),
});
export type LocalMaiaEngine = z.output<typeof localMaiaEngineSchema>;

const localEngineSchema = z.discriminatedUnion("runtime", [
  localUciEngineSchema,
  localMaiaEngineSchema,
]);
export type LocalEngine = z.output<typeof localEngineSchema>;

const remoteEngineSchema = z.object({
  type: z.enum(["chessdb", "lichess"]),
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string(),
  url: z.string(),
  image: z.string().nullish(),
  loaded: z.boolean().nullish(),
  enabled: z.boolean().nullish(),
  go: goModeSchema.optional(),
  settings: engineSettingsSchema.nullish(),
});

export type RemoteEngine = z.output<typeof remoteEngineSchema>;

export const engineSchema = z.discriminatedUnion("type", [
  localEngineSchema,
  remoteEngineSchema,
]);
export type Engine = z.output<typeof engineSchema>;

export function stopEngine(engine: LocalEngine, tab: string): Promise<void> {
  return commands.stopEngine(engine.id, tab).then((r) => {
    unwrap(r);
  });
}

export function killEngine(engine: LocalEngine, tab: string): Promise<void> {
  return commands.killEngine(engine.id, tab).then((r) => {
    unwrap(r);
  });
}

export function getBestMoves(
  engine: LocalEngine,
  tab: string,
  goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  return commands
    .getBestMoves(engine.id, engine.path, tab, goMode, options)
    .then((r) => unwrap(r));
}

export function useDefaultEngines(os: Platform | undefined, opened: boolean) {
  const { data, error, isLoading } = useSWR(
    opened ? os : null,
    async (os: Platform) => {
      const bmi2: boolean = await commands.isBmi2Compatible();
      const data = await fetch(
        `https://www.encroissant.org/engines?os=${os}&bmi2=${bmi2}`,
        {
          method: "GET",
        },
      );
      if (!data.ok) {
        throw new Error("Failed to fetch engines");
      }
      return (await data.json()).filter(
        (e: { os: Platform; bmi2: boolean }) => e.os === os && e.bmi2 === bmi2,
      );
    },
  );
  return {
    defaultEngines: data as LocalEngine[],
    error,
    isLoading,
  };
}
export function isLocalEngine(engine: Engine): engine is LocalEngine {
  return engine.type === "local";
}
export function isUciEngine(engine: LocalEngine): engine is LocalUciEngine {
  return engine.runtime === "uci";
}

export function isMaiaEngine(engine: LocalEngine): engine is LocalMaiaEngine {
  return engine.runtime === "maia";
}
