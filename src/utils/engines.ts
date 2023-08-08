import { BaseDirectory, readTextFile } from "@tauri-apps/api/fs";

export interface Engine {
    name: string;
    version: string;
    path: string;
    image: string;
    elo: number | "";
    downloadSize?: number;
    downloadLink?: string;
    loaded?: boolean;
}

export async function getEngines() {
    const text = await readTextFile("engines/engines.json", {
        dir: BaseDirectory.AppData,
    });
    if (text === "") {
        return [];
    }
    const data = JSON.parse(text);
    return data as Engine[];
}
