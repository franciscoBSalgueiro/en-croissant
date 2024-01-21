import useSWR from "swr";
import { invoke, unwrap } from "./invoke";
import { fetch } from "@tauri-apps/api/http";
import { BestMoves, EngineOptions, GoMode, commands } from "@/bindings";
import { z } from "zod";

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

const engineOptionsSchema: z.ZodSchema<Omit<EngineOptions, "fen" | "moves">> = z.object({
    multipv: z.number(),
    threads: z.number(),
    hash: z.number(),
    extraOptions: z.array(z.object({ name: z.string(), value: z.string() })),
});

const engineSettingsSchema = z.object({
    enabled: z.boolean(),
    go: goModeSchema,
    options: engineOptionsSchema,
});

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
    settings: engineSettingsSchema.nullish(),
});

export type LocalEngine = z.infer<typeof localEngineSchema>;

const remoteEngineSchema = z.object({
    type: z.enum(["chessdb", "lichess"]),
    name: z.string(),
    url: z.string(),
    image: z.string().nullish(),
    settings: engineSettingsSchema.nullish(),
    loaded: z.boolean().nullish(),
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
    options: EngineOptions
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
                }
            );
            if (!data.ok) {
                throw new Error("Failed to fetch engines");
            }
            /// @ts-expect-error only exists on dowloaded
            return data.data.filter((e) => e.os === os && e.bmi2 === bmi2);
        }
    );
    return {
        defaultEngines: data,
        error,
        isLoading,
    };
}
