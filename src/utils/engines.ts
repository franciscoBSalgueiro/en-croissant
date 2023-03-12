import { OS } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api";
import { BaseDirectory, readTextFile } from "@tauri-apps/api/fs";
import { fetch } from "@tauri-apps/api/http";

export enum EngineStatus {
    Installed,
    Downloading,
    NotInstalled,
}

export interface Engine {
    image: string;
    name: string;
    status: EngineStatus;
    downloadLink?: string;
    downloadSize?: number;
    elo: number | null;
    path: string;
    progress?: number;
    active?: boolean;
}

export interface EngineSettings {
    name: string;
    binary: string;
    image: string;
    elo: number | null;
}

export async function getDefaultEngines(os: OS): Promise<Engine[]> {
    let data: any = await fetch(
        "https://www.encroissant.org/engines?os=" + os,
        {
            method: "GET",
        }
    );
    if (!data.ok) {
        throw new Error("Failed to fetch engines");
    }
    let engines: Engine[] = data.data.map((engine: any) => {
        return {
            name: engine.name + " " + engine.version,
            image: engine.image,
            status: EngineStatus.NotInstalled,
            downloadLink: engine.downloadLink,
            path: engine.path,
            downloadSize: engine.downloadSize,
            elo: engine.elo,
        };
    });
    return engines;
}

export async function getEngineSettings() {
    const text = await readTextFile("engines/engines.json", {
        dir: BaseDirectory.AppData,
    });
    const data = JSON.parse(text);
    return data as EngineSettings[];
}

export async function getEngines(): Promise<Engine[]> {
    const engineSettings = await getEngineSettings();
    const engines = await Promise.all(
        engineSettings.map(async (engine) => {
            const exists = await invoke("file_exists", {
                path: engine.binary,
            });
            return {
                image: engine.image,
                name: engine.name,
                status: exists
                    ? EngineStatus.Installed
                    : EngineStatus.NotInstalled,
                path: engine.binary,
                elo: engine.elo,
            };
        })
    );

    return [...engines];
}
