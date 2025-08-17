import {
  type BestMoves,
  type EngineOption,
  type EngineOptions,
  type GoMode,
  commands,
  type Score,
} from "@/bindings";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { info, warn } from "@tauri-apps/plugin-log";
import type { Platform } from "@tauri-apps/plugin-os";
import useSWR from "swr";
import { z } from "zod";
import { unwrap } from "./unwrap";
import { invoke } from "@tauri-apps/api/core";

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
  go: goModeSchema.nullish(),
  settings: engineSettingsSchema.nullish(),
});

export type RemoteEngine = z.infer<typeof remoteEngineSchema>;

export const engineSchema = z.union([localEngineSchema, remoteEngineSchema]);
export type Engine = z.infer<typeof engineSchema>;

export async function saveEngines(engines: Engine[]): Promise<void> {
  try {
    const dir = await appDataDir();
    const fullPath = await resolve(dir, "engines", "engines.json");
    await info(
      `saveEngines: writing ${engines.length} engine(s) to ${fullPath}`,
    );
    await writeTextFile(fullPath as any, JSON.stringify(engines, null, 4));
    const raw: any = await readTextFile(fullPath as any);
    const contents = typeof raw === "string" ? raw : String(raw);
    await info(
      `saveEngines: verify read ${contents ? contents.length : 0} bytes`,
    );
    if (!contents || contents.length === 0) {
      await warn("saveEngines: file is empty after write");
    }
  } catch (e) {
    await warn(`saveEngines: write failed: ${e}`);
  }
}

export function stopEngine(engine: LocalEngine, tab: string): Promise<void> {
  return commands.stopEngine(engine.path, tab).then((r) => {
    unwrap(r);
  });
}

export function killEngine(engine: LocalEngine, tab: string): Promise<void> {
  return commands.killEngine(engine.path, tab).then((r) => {
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

export type MoveScore = { uci: string; score: Score };

export function scoreAllMoves(
  engine: LocalEngine,
  goMode: GoMode,
  options: EngineOptions,
): Promise<MoveScore[]> {
  return commands.scoreAllMoves(engine.path, goMode, options).then((r) => unwrap(r));
}



export function useDefaultEngines(os: Platform | undefined, opened: boolean) {
  const { data, error, isLoading } = useSWR(
    opened ? os : null,
    async (os: Platform) => {
      const bmi2: boolean = await commands.isBmi2Compatible();
      const data = await fetch(
        `https://www.botvinnik.org/engines?os=${os}&bmi2=${bmi2}`,
        {
          method: "GET",
        },
      );
      if (!data.ok) {
        throw new Error("Failed to fetch engines");
      }
      return (await data.json()).filter(
        (e: {
          os: Platform;
          bmi2: boolean;
        }) => e.os === os && e.bmi2 === bmi2,
      );
    },
  );
  return {
    defaultEngines: data as LocalEngine[],
    error,
    isLoading,
  };
}

/**
 * Resolve the absolute path to a bundled Stockfish binary for the current platform.
 * Returns null if not available (e.g., unsupported OS or resource missing).
 */
export async function getBundledStockfishPath(): Promise<string | null> {
  try {
    const path = await invoke<string>("get_bundled_stockfish_path");
    return path || null;
  } catch {
    return null;
  }
}
