import useSWR from "swr";
import { invoke, unwrap } from "./invoke";
import { fetch } from "@tauri-apps/api/http";
import { EngineSettings } from "@/atoms/atoms";
import { BestMoves, EngineOptions, GoMode, commands } from "@/bindings";

export interface Engine {
    name: string;
    remote: boolean;
    loaded: boolean;
    image?: string;
    settings?: EngineSettings;
    stop(tab: string): Promise<void>;
    getBestMoves(
        tab: string,
        goMode: GoMode,
        options: EngineOptions
    ): Promise<[number, BestMoves[]] | null>;
}

export type LocalEngine = {
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

export function localEngine(engine: LocalEngine): Engine {
    return {
        remote: false,
        loaded: engine.loaded ?? false,
        name: engine.name,
        settings: engine.settings,
        image: engine.image,
        stop: (tab) =>
            commands.stopEngine(engine.path, tab).then((r) => {
                unwrap(r);
            }),
        getBestMoves: (tab, goMode, options) => {
            return commands
                .getBestMoves(engine.name, engine.path, tab, goMode, options)
                .then((r) => unwrap(r));
        },
    };
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
            return data.data;
        }
    );
    return {
        defaultEngines: data,
        error,
        isLoading,
    };
}
