import { fetch } from "@tauri-apps/plugin-http";
import { type Arch, arch, type Platform } from "@tauri-apps/plugin-os";
import useSWR from "swr";
import { z } from "zod";
import { type BestMoves, commands, type EngineOptions, type GoMode } from "@/bindings";
import { unwrap } from "./unwrap";

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
    id: z.string().default(() => crypto.randomUUID()),
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

export type LocalEngine = z.output<typeof localEngineSchema>;

const remoteEngineSchema = z.object({
    type: z.enum(["chessdb", "lichess"]),
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string(),
    url: z.string(),
    image: z.string().nullish(),
    loaded: z.boolean().nullish(),
    enabled: z.boolean().nullish(),
    go: goModeSchema.nullish(),
    settings: engineSettingsSchema.nullish(),
});

export type RemoteEngine = z.output<typeof remoteEngineSchema>;

export const engineSchema = z.union([localEngineSchema, remoteEngineSchema]);
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
    const { data, error, isLoading } = useSWR(opened ? os : null, async (os: Platform) => {
        const bmi2: boolean = await commands.isBmi2Compatible();
        const currentArch: Arch = arch();
        const data = await fetch(
            `https://www.encroissant.org/engines?os=${os}&bmi2=${bmi2}&arch=${currentArch}`,
            {
                method: "GET",
            },
        );
        if (!data.ok) {
            throw new Error("Failed to fetch engines");
        }
        return (await data.json()).filter(
            // Both `arch` and `bmi2` are optional, and an absent key means "applies
            // to every value" rather than "false".
            //
            // `bmi2` is an x86 instruction set, so aarch64 entries simply omit it
            // instead of being duplicated once for each boolean. `arch` is only set
            // where a platform actually ships more than one build, so engines with
            // no ARM build stay visible to Windows-on-ARM users, who run them under
            // emulation, rather than leaving them with an empty list.
            (e: { os: Platform; bmi2?: boolean; arch?: Arch }) =>
                e.os === os &&
                (e.bmi2 === undefined || e.bmi2 === bmi2) &&
                (e.arch === undefined || e.arch === currentArch),
        );
    });
    return {
        defaultEngines: data as LocalEngine[],
        error,
        isLoading,
    };
}
