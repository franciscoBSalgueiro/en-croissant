import { basename, dirname, join } from "@tauri-apps/api/path";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import { readDir, readFile, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { getPiecesDir } from "@/utils/directories";
import {
    buildPieceSetCss,
    BUILTIN_PIECE_SETS,
    customPieceSetId,
    findCssUrlRefs,
    guessImageMime,
    imageFileNameToSlot,
    isPieceImageFile,
    MAX_PIECE_SET_CSS_LENGTH,
    PIECE_SLOTS,
    parsePieceSetCss,
    type PieceSlot,
    sanitizePieceSetCss,
    slugifyPieceSetName,
    uniquePieceSetName,
} from "@/utils/pieceSets";

/** Single images larger than this are kept as file references instead of inlined. */
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

export type CustomPieceSet = {
    /** File name without the `.css` extension, also used as the display name. */
    name: string;
    /** Value stored in `pieceSetAtom`, e.g. `custom/my-pieces`. */
    id: string;
    /** Absolute path of the stylesheet. */
    path: string;
    covered: PieceSlot[];
    missing: PieceSlot[];
    /** Image references the app cannot serve (relative paths that could not be read). */
    externalUrls: string[];
};

export type CustomPieceSetError = "empty" | "no-rules" | "too-large" | "no-images" | "failed";

export type ImportPieceSetResult =
    | { ok: true; set: CustomPieceSet }
    | { ok: false; error: CustomPieceSetError; detail?: string };

type CacheEntry = {
    /** Sanitized stylesheet, ready to be injected. */
    css: string;
    set: CustomPieceSet;
};

const cache = new Map<string, CacheEntry>();

/** Drops cached stylesheets, e.g. after importing or deleting a piece set. */
export function invalidateCustomPieceSets() {
    cache.clear();
}

export async function getCustomPieceSetsDir(): Promise<string> {
    return getPiecesDir();
}

export async function customPieceSetPath(name: string): Promise<string> {
    return join(await getPiecesDir(), `${name}.css`);
}

function toCustomPieceSet(path: string, name: string, css: string): CustomPieceSet {
    const info = parsePieceSetCss(css);
    return {
        name,
        id: customPieceSetId(name),
        path,
        covered: info.covered,
        missing: info.missing,
        externalUrls: info.externalUrls,
    };
}

async function loadCustomPieceSet(path: string, name: string): Promise<CacheEntry> {
    const cached = cache.get(path);
    if (cached) {
        return cached;
    }

    const css = sanitizePieceSetCss(await readTextFile(path));
    const entry = { css, set: toCustomPieceSet(path, name, css) };
    cache.set(path, entry);
    return entry;
}

/**
 * Every `*.css` file in the pieces directory is a piece set. Broken files are
 * skipped instead of failing the whole list.
 */
export async function listCustomPieceSets(): Promise<CustomPieceSet[]> {
    let dir: string;
    try {
        dir = await getPiecesDir();
    } catch {
        // Tauri APIs are unavailable (e.g. in tests or in the browser).
        return [];
    }

    let entries: DirEntry[] = [];
    try {
        entries = await readDir(dir);
    } catch {
        return [];
    }

    const files = entries.filter((entry) => entry.isFile && /\.css$/i.test(entry.name));
    const sets = await Promise.all(
        files.map(async (entry) => {
            const path = await join(dir, entry.name);
            const name = entry.name.replace(/\.css$/i, "");
            try {
                return (await loadCustomPieceSet(path, name)).set;
            } catch {
                return null;
            }
        }),
    );

    return sets
        .filter((set): set is CustomPieceSet => set !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
}

export async function readCustomPieceSetCss(name: string): Promise<string> {
    const path = await customPieceSetPath(name);
    return (await loadCustomPieceSet(path, name)).css;
}

async function takenPieceSetNames(): Promise<string[]> {
    const custom = await listCustomPieceSets();
    return [...BUILTIN_PIECE_SETS.map((set) => set.value), ...custom.map((set) => set.name)];
}

async function writeCustomPieceSet(name: string, css: string): Promise<CustomPieceSet> {
    const path = await customPieceSetPath(name);
    await writeTextFile(path, css);
    invalidateCustomPieceSets();
    const set = toCustomPieceSet(path, name, css);
    cache.set(path, { css, set });
    return set;
}

function bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        for (let i = 0; i < chunk.length; i++) {
            binary += String.fromCharCode(chunk[i]);
        }
    }
    return btoa(binary);
}

/**
 * Replaces `url(...)` references pointing at files next to the stylesheet with
 * data URIs, so the imported piece set keeps working from its new location.
 */
async function inlineRelativeImages(
    css: string,
    sourceDir: string,
): Promise<{ css: string; failed: string[] }> {
    const refs = findCssUrlRefs(css).filter((ref) => ref.kind === "relative");
    const replacements = new Map<string, string>();
    const failed: string[] = [];

    for (const ref of refs) {
        if (replacements.has(ref.value) || failed.includes(ref.value)) continue;
        try {
            const bytes = await readFile(await join(sourceDir, ref.value));
            if (bytes.length > MAX_INLINE_IMAGE_BYTES) {
                failed.push(ref.value);
                continue;
            }
            const mime = guessImageMime(ref.value) ?? "application/octet-stream";
            replacements.set(ref.value, `data:${mime};base64,${bytesToBase64(bytes)}`);
        } catch {
            failed.push(ref.value);
        }
    }

    if (replacements.size === 0) {
        return { css, failed };
    }

    return {
        css: css.replace(
            /url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"]*))\s*\)/gi,
            (match, single, double, bare) => {
                const value = (single ?? double ?? bare ?? "").trim();
                const replacement = replacements.get(value);
                return replacement ? `url("${replacement}")` : match;
            },
        ),
        failed,
    };
}

/**
 * Imports a piece set from an existing stylesheet. Images referenced with
 * relative paths are inlined when they can be read.
 */
export async function importCustomPieceSetFromCssFile(
    sourcePath: string,
): Promise<ImportPieceSetResult> {
    try {
        const raw = await readTextFile(sourcePath);
        if (!raw.trim()) {
            return { ok: false, error: "empty" };
        }
        if (raw.length > MAX_PIECE_SET_CSS_LENGTH) {
            return { ok: false, error: "too-large" };
        }

        const { css: inlinedCss } = await inlineRelativeImages(raw, await dirname(sourcePath));
        const css = sanitizePieceSetCss(inlinedCss);
        const info = parsePieceSetCss(css);
        if (info.covered.length === 0) {
            return { ok: false, error: "no-rules" };
        }

        const sourceName = await basename(sourcePath);
        const name = uniquePieceSetName(
            slugifyPieceSetName(sourceName),
            await takenPieceSetNames(),
        );

        return { ok: true, set: await writeCustomPieceSet(name, css) };
    } catch (error) {
        return { ok: false, error: "failed", detail: String(error) };
    }
}

/**
 * Looks for piece images in `dir` and, when the directory itself contains none,
 * in its direct subdirectories (piece packs are often shipped in a nested
 * `pieces` folder).
 */
async function collectPieceImages(dir: string): Promise<Map<PieceSlot, string>> {
    const collect = async (candidate: string, entries: DirEntry[]) => {
        const found = new Map<PieceSlot, string>();
        for (const entry of entries) {
            if (!entry.isFile || !isPieceImageFile(entry.name)) continue;
            const slot = imageFileNameToSlot(entry.name);
            if (!slot || found.has(slot)) continue;
            found.set(slot, await join(candidate, entry.name));
        }
        return found;
    };

    let entries: DirEntry[];
    try {
        entries = await readDir(dir);
    } catch {
        return new Map();
    }

    const top = await collect(dir, entries);
    if (top.size > 0) return top;

    for (const entry of entries) {
        if (!entry.isDirectory) continue;
        const subdir = await join(dir, entry.name);
        let nested: DirEntry[];
        try {
            nested = await readDir(subdir);
        } catch {
            continue;
        }
        const found = await collect(subdir, nested);
        if (found.size > 0) return found;
    }

    return new Map();
}

/** Imports a piece set from a folder holding one image per piece. */
export async function importCustomPieceSetFromFolder(
    dirPath: string,
): Promise<ImportPieceSetResult> {
    try {
        const images = await collectPieceImages(dirPath);
        if (images.size === 0) {
            return { ok: false, error: "no-images" };
        }

        const entries: { slot: PieceSlot; dataUri: string }[] = [];
        for (const slot of PIECE_SLOTS) {
            const path = images.get(slot);
            if (!path) continue;
            const bytes = await readFile(path);
            if (bytes.length > MAX_INLINE_IMAGE_BYTES) continue;
            const mime = guessImageMime(path) ?? "application/octet-stream";
            entries.push({ slot, dataUri: `data:${mime};base64,${bytesToBase64(bytes)}` });
        }

        if (entries.length === 0) {
            return { ok: false, error: "no-images" };
        }

        const css = buildPieceSetCss(entries, dirPath);
        const name = uniquePieceSetName(
            slugifyPieceSetName(await basename(dirPath)),
            await takenPieceSetNames(),
        );

        return { ok: true, set: await writeCustomPieceSet(name, css) };
    } catch (error) {
        return { ok: false, error: "failed", detail: String(error) };
    }
}

export async function deleteCustomPieceSet(name: string): Promise<void> {
    const path = await customPieceSetPath(name);
    cache.delete(path);
    await remove(path);
    invalidateCustomPieceSets();
}
