import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";
import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";
import { getDefaultStore } from "jotai";

const POOL_SIZE = 5;
const audioPool = Array.from({ length: POOL_SIZE }, () => new Audio());
let poolIndex = 0;

const soundUrlCache = new Map<string, string>();

let lastTime = 0;

export function playSound(capture: boolean, check: boolean) {
  // only play at most 1 sound every 75ms
  const now = Date.now();
  if (now - lastTime < 75) {
    return;
  }
  lastTime = now;

  const store = getDefaultStore();
  const collection = store.get(soundCollectionAtom);
  const volume = store.get(soundVolumeAtom);

  let type = "Move";
  if (capture) {
    type = "Capture";
  }
  if (collection !== "standard" && check) {
    type = "Check";
  }

  const cacheKey = `${collection}/${type}`;

  const playWithUrl = (url: string) => {
    const player = audioPool[poolIndex];
    poolIndex = (poolIndex + 1) % POOL_SIZE;

    player.src = url;
    player.volume = volume;
    player.play().catch((e) => console.error("Audio playback error:", e));
  };

  if (soundUrlCache.has(cacheKey)) {
    playWithUrl(soundUrlCache.get(cacheKey)!);
    return;
  }

  const path = `sound/${collection}/${type}.mp3`;

  resolveResource(path)
    .then((filePath) => {
      const assetUrl = convertFileSrc(filePath);
      soundUrlCache.set(cacheKey, assetUrl);

      playWithUrl(assetUrl);
    })
    .catch(() => {
      // fails if Tauri APIs are unavailable (e.g., in tests)
    });
}
