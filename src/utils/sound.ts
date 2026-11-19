import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import { getDefaultStore } from "jotai";
import { commands } from "@/bindings/generated";
import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";

const POOL_SIZE = 5;
const audioPool = Array.from({ length: POOL_SIZE }, () => new Audio());
let poolIndex = 0;

let soundServerPort: number | null = null;
const soundUrlCache = new Map<string, string>();

function isLinux(): boolean {
    try {
        return platform() === "linux";
    } catch {
        return false;
    }
}

let lastTime = 0;
// returns the sound type based on moves i.e. check, capture, castles and checkmate
export function getSoundType(
    capture: boolean,
    check: boolean,
    castles = false,
    checkmate = false,
): string {
    if (checkmate) {
        return "Checkmate";
    }
    if (castles) {
        return "Castles";
    }
    if (check) {
        return "Check";
    }
    if (capture) {
        return "Capture";
    }
    return "Move";
}

async function getSoundServerPort(): Promise<number> {
    if (soundServerPort !== null) {
        return soundServerPort;
    }
    const result = await commands.getSoundServerPort();
    if (result.status === "ok") {
        soundServerPort = result.data;
        return soundServerPort;
    }
    throw new Error("Failed to get sound server port");
}

export function playSound(capture: boolean, check: boolean, castles = false, checkmate = false) {
    // only play at most 1 sound every 75ms
    const now = Date.now();
    if (now - lastTime < 75) {
        return;
    }
    lastTime = now;

    const store = getDefaultStore();
    const collection = store.get(soundCollectionAtom);
    const volume = store.get(soundVolumeAtom);

    const type = getSoundType(capture, check, castles, checkmate);
    const fallbackType = type === "Checkmate" ? "Check" : type === "Castles" ? "Move" : null;

    const cacheKey = `${collection}/${type}`;

    const playWithUrl = (url: string, fallbackUrl?: string) => {
        const player = audioPool[poolIndex];
        poolIndex = (poolIndex + 1) % POOL_SIZE;

        player.src = url;
        player.volume = volume;
        player.play().catch((error) => {
            if (fallbackUrl) {
                playWithUrl(fallbackUrl);
            } else {
                console.error("Audio playback error:", error);
            }
        });
    };

    if (isLinux()) {
        getSoundServerPort()
            .then((port) => {
                const url = `http://127.0.0.1:${port}/${collection}/${type}.mp3`;
                const fallbackUrl = fallbackType
                    ? `http://127.0.0.1:${port}/${collection}/${fallbackType}.mp3`
                    : undefined;
                playWithUrl(url, fallbackUrl);
            })
            .catch((error) => {
                console.error("Failed to load sound server:", error);
            });
    } else {
        const path = `sound/${collection}/${type}.mp3`;
        const fallbackPath = fallbackType ? `sound/${collection}/${fallbackType}.mp3` : undefined;

        if (soundUrlCache.has(cacheKey)) {
            playWithUrl(soundUrlCache.get(cacheKey)!);
            return;
        }
        resolveResource(path)
            .then((filePath) => {
                const assetUrl = convertFileSrc(filePath);
                soundUrlCache.set(cacheKey, assetUrl);

                if (fallbackPath) {
                    resolveResource(fallbackPath)
                        .then((fallbackFilePath) =>
                            playWithUrl(assetUrl, convertFileSrc(fallbackFilePath)),
                        )
                        .catch(() => playWithUrl(assetUrl));
                } else {
                    playWithUrl(assetUrl);
                }
            })
            .catch((error) => {
                if (fallbackPath) {
                    resolveResource(fallbackPath)
                        .then((filePath) => playWithUrl(convertFileSrc(filePath)))
                        .catch((error) =>
                            console.error("Failed to resolve sound resource:", error),
                        );
                } else {
                    console.error("Failed to resolve sound resource:", error);
                }
            });
    }
}
