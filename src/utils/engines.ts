import useSWR from "swr";
import { invoke, unwrap } from "./invoke";
import { fetch } from "@tauri-apps/api/http";
import { EngineSettings } from "@/atoms/atoms";
import { BestMoves, EngineOptions, GoMode, commands } from "@/bindings";

export type Engine = LocalEngine | RemoteEngine;

export type LocalEngine = {
    type: "local";
    name: string;
    version: string;
    path: string;
    image?: string;
    elo: number | "";
    downloadSize?: number;
    downloadLink?: string;
    loaded?: boolean;
    settings?: EngineSettings;
};

export type RemoteEngine = {
    type: "chessdb" | "lichess";
    name: string;
    url: string;
    image?: string;
    settings?: EngineSettings;
    loaded?: boolean;
};

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
