import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";
import { getDefaultStore } from "jotai";

export function playSound(capture: boolean, check: boolean) {
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

  const audio = new Audio(`/sound/${collection}/${type}.mp3`);
  audio.volume = volume;
  audio.play();
}
