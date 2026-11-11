import { appDataDir, resolve } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { parseOpeningCatalog, type OpeningCatalog } from "./openingCatalog";

export const OPENING_CATALOG_REVISION = "a6189a30dc273ccb21fc2536a9a2fefd5592a67a";
const baseUrl = `https://raw.githubusercontent.com/lichess-org/chess-openings/${OPENING_CATALOG_REVISION}`;

async function cachePath() {
    return resolve(await appDataDir(), `opening-catalog-${OPENING_CATALOG_REVISION}.json`);
}

export async function loadOpeningCatalog(): Promise<OpeningCatalog | null> {
    try {
        const saved = JSON.parse(await readTextFile(await cachePath()));
        if (
            saved.revision !== OPENING_CATALOG_REVISION ||
            !Array.isArray(saved.volumes) ||
            !saved.volumes.every((volume: unknown) => typeof volume === "string")
        )
            return null;
        return parseOpeningCatalog(saved.volumes);
    } catch {
        // Missing or interrupted downloads can be downloaded again from the dialog.
        return null;
    }
}

export async function downloadOpeningCatalog(): Promise<OpeningCatalog> {
    const volumes = await Promise.all(
        ["a", "b", "c", "d", "e"].map(async (volume) => {
            const response = await fetch(`${baseUrl}/${volume}.tsv`);
            if (!response.ok)
                throw new Error(`Opening catalog download failed: HTTP ${response.status}`);
            return response.text();
        }),
    );
    const catalog = parseOpeningCatalog(volumes);
    const dir = await appDataDir();
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeTextFile(
        await cachePath(),
        JSON.stringify({ revision: OPENING_CATALOG_REVISION, volumes }),
    );
    return catalog;
}
