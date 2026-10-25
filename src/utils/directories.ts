import { appDataDir, documentDir, homeDir, resolve } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";

function getStoredDirectory(key: string): string | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    try {
        const parsed = JSON.parse(stored);
        return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

async function ensureDirectory(path: string): Promise<string> {
    if (!(await exists(path))) {
        await mkdir(path, { recursive: true });
    }
    return path;
}

export async function getDatabasesDir(): Promise<string> {
    const customDir = getStoredDirectory("databases-dir");
    if (customDir) {
        return ensureDirectory(customDir);
    }

    return ensureDirectory(await resolve(await appDataDir(), "db"));
}

export async function getDocumentDir(): Promise<string> {
    const customDir = getStoredDirectory("document-dir");
    if (customDir) {
        return ensureDirectory(customDir);
    }

    try {
        return ensureDirectory(await resolve(await documentDir(), "EnCroissant"));
    } catch {
        return ensureDirectory(await resolve(await homeDir(), "EnCroissant"));
    }
}

export async function getEnginesDir(): Promise<string> {
    const customDir = getStoredDirectory("engines-dir");
    if (customDir) {
        return ensureDirectory(customDir);
    }

    return ensureDirectory(await resolve(await appDataDir(), "engines"));
}

async function fileExists(path: string): Promise<boolean> {
    try {
        return await exists(path);
    } catch {
        // `exists` throws for invalid paths (e.g. Windows os error 267)
        return false;
    }
}

/**
 * Engines are stored in `engines.json` with an absolute path taken when they
 * were added. After the engines directory is changed, those paths still point
 * at the old location, so fall back to a file with the same name inside the
 * current engines directory.
 */
export async function resolveEnginePath(path: string): Promise<string> {
    if (await fileExists(path)) return path;

    const filename = path.split(/[\\/]/).pop();
    if (!filename) return path;

    try {
        const candidate = await resolve(await getEnginesDir(), filename);
        if (await fileExists(candidate)) return candidate;
    } catch {
        // keep the stored path so callers report the real location
    }

    return path;
}

export async function getPuzzlesDir(): Promise<string> {
    const customDir = getStoredDirectory("puzzles-dir");
    if (customDir) {
        return ensureDirectory(customDir);
    }

    return ensureDirectory(await resolve(await appDataDir(), "puzzles"));
}
