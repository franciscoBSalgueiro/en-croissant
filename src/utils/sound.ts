import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";
import { getDefaultStore } from "jotai";
import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";

let lastTime = 0;
const audio = new Audio();

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

  const path = `sound/${collection}/${type}.mp3`;

  resolveResource(path)
    .then((filePath: string) => {
      const assetUrl = convertFileSrc(filePath);
      audio.src = assetUrl;
      audio.volume = volume;
      audio.play();
    })
    .catch(() => {
      // fails if Tauri APIs are unavailable (e.g., in tests)
    });
}
