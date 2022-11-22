import { useOs } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api";
import { BaseDirectory, exists, readTextFile } from "@tauri-apps/api/fs";

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
    path: string;
    progress?: number;
}

export interface EngineSettings {
    name: string;
    binary: string;
    image: string;
}

export function getDefaultEngines(): Engine[] {
    const os = useOs();
    return [
        {
            image: "/stockfish.png",
            name: "Stockfish 15",
            status: EngineStatus.NotInstalled,
            downloadLink:
                os === "windows"
                    ? "https://stockfishchess.org/files/stockfish_15_win_x64_avx2.zip"
                    : "https://stockfishchess.org/files/stockfish_15_linux_x64_bmi2.zip",
            path:
                os === "windows"
                    ? "engines/stockfish_15_win_x64_avx2/stockfish_15_x64_avx2.exe"
                    : "engines/stockfish_15_linux_x64_bmi2/stockfish_15_x64_bmi2",
        },
        {
            image: "/komodo.png",
            name: "Komodo 13",
            status: EngineStatus.NotInstalled,
            downloadLink: "https://komodochess.com/pub/komodo-13.zip",
            path:
                os === "windows"
                    ? "engines/komodo-13_201fd6/Windows/komodo-13.02-64bit-bmi2.exe"
                    : "engines/komodo-13_201fd6/Linux/komodo-13.02-bmi2",
        },
    ];
}

export async function getEngineSettings() {
    const text = await readTextFile("engines/engines.json", {
        dir: BaseDirectory.AppData,
    });
    const data = JSON.parse(text);
    return data as EngineSettings[];
}

export async function getEngines() {
    const engineSettings = await getEngineSettings();
    const defaultEngines = getDefaultEngines();
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
            };
        })
    );
    const updatedDefaultEngines = await Promise.all(
        defaultEngines.map(async (engine) => {
            const installed = await exists(engine.path, {
                dir: BaseDirectory.AppData,
            });
            engine.status = installed
                ? EngineStatus.Installed
                : EngineStatus.NotInstalled;
            return engine;
        })
    );

    return [...engines, ...updatedDefaultEngines];
}
