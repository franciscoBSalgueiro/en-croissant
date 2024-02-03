import { BestMoves, EngineOptions, GoMode, commands } from "@/bindings";
import { fetch } from "@tauri-apps/api/http";
import useSWR from "swr";
import { z } from "zod";
import { invoke, unwrap } from "./invoke";

export const requiredEngineSettings = ["MultiPV", "Threads", "Hash"];

const goModeSchema: z.ZodSchema<GoMode> = z.union([
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

const localEngineSchema = z.object({
  type: z.literal("local"),
  name: z.string(),
  version: z.string(),
  path: z.string(),
  image: z.string().nullish(),
  elo: z.number().nullish(),
  downloadSize: z.number().nullish(),
  downloadLink: z.string().nullish(),
  loaded: z.boolean().nullish(),
  go: goModeSchema.nullish(),
  enabled: z.boolean().nullish(),
  settings: engineSettingsSchema.nullish(),
});

export type LocalEngine = z.infer<typeof localEngineSchema>;

const remoteEngineSchema = z.object({
  type: z.enum(["chessdb", "lichess"]),
  name: z.string(),
  url: z.string(),
  image: z.string().nullish(),
  loaded: z.boolean().nullish(),
  enabled: z.boolean().nullish(),
  multipv: z.number().nullish(),
  settings: engineSettingsSchema.nullish(),
});

export type RemoteEngine = z.infer<typeof remoteEngineSchema>;

export const engineSchema = z.union([localEngineSchema, remoteEngineSchema]);
export type Engine = z.infer<typeof engineSchema>;

export function stopEngine(engine: LocalEngine, tab: string): Promise<void> {
  return commands.stopEngine(engine.path, tab).then((r) => {
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
    .getBestMoves(engine.name, engine.path, tab, goMode, options)
    .then((r) => unwrap(r));
}

type OS = "windows" | "linux" | "macos";

export function useDefaultEngines(os: OS | undefined, opened: boolean) {
  const { data, error, isLoading } = useSWR(
    opened ? os : null,
    async (os: OS) => {
      const bmi2: boolean = await invoke("is_bmi2_compatible");
      const data = await fetch<LocalEngine[]>(
        `https://www.encroissant.org/engines?os=${os}&bmi2=${bmi2}`,
        {
          method: "GET",
        },
      );
      if (!data.ok) {
        throw new Error("Failed to fetch engines");
      }
      /// @ts-expect-error only exists on dowloaded
      return data.data.filter((e) => e.os === os && e.bmi2 === bmi2);
    },
  );
  return {
    defaultEngines: data,
    error,
    isLoading,
  };
}
