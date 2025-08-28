import { type BestMoves, type EngineOptions, type GoMode, type Score } from "@/bindings";
import type { Platform } from "@/bindings";
import useSWR from "swr";
import { z } from "zod";
import { getBestMoves as webGetBestMoves, scoreAllMoves as webScoreAllMoves, stopEngine as webStopEngine, killEngine as webKillEngine } from "@/utils/engines.web";

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

export async function saveEngines(_engines: Engine[]): Promise<void> { /* no-op in web-first */ }

export function stopEngine(_engine: LocalEngine, _tab: string): Promise<void> { return webStopEngine(); }

export function killEngine(_engine: LocalEngine, _tab: string): Promise<void> { return webKillEngine(); }

export function getBestMoves(
  engine: LocalEngine,
  tab: string,
  goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  return webGetBestMoves(engine.name, tab, goMode, options) as any;
}

export type MoveScore = { uci: string; score: Score };

export function scoreAllMoves(
  engine: LocalEngine,
  goMode: GoMode,
  options: EngineOptions,
): Promise<MoveScore[]> {
  return webScoreAllMoves(engine.name, goMode, options) as any;
}



export function useDefaultEngines(_os: Platform | undefined, opened: boolean) {
  const data = opened ? [] : [];
  return { defaultEngines: data as unknown as LocalEngine[], error: undefined, isLoading: false };
}

/**
 * Resolve the absolute path to a bundled Stockfish binary for the current platform.
 * Returns null if not available (e.g., unsupported OS or resource missing).
 */
export async function getBundledStockfishPath(): Promise<string | null> { return null; }
