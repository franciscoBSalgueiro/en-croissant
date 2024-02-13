import { atomWithStorage } from "jotai/utils";
import {
  SyncStorage,
  SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";

const keys = {
  NEW_TAB: { name: "New tab", keys: "ctrl+t" },
  CLOSE_TAB: { name: "Close tab", keys: "ctrl+w" },
  OPEN_FILE: { name: "Open File", keys: "ctrl+o" },
  SAVE_FILE: { name: "Save File", keys: "ctrl+s" },
  SWAP_ORIENTATION: { name: "Swap orientation", keys: "f" },
  CLEAR_SHAPES: { name: "Clear shapes", keys: "ctrl+l" },
  NEXT_MOVE: { name: "Next move", keys: "arrowright" },
  PREVIOUS_MOVE: { name: "Previous move", keys: "arrowleft" },
  GO_TO_START: { name: "Go to start of game", keys: "arrowup" },
  GO_TO_END: { name: "Go to end of game", keys: "arrowdown" },
  DELETE_MOVE: { name: "Delete move", keys: "delete" },
  CYCLE_TABS: { name: "Cycle tabs", keys: "ctrl+tab" },
  REVERSE_CYCLE_TABS: { name: "Reverse cycle tabs", keys: "ctrl+shift+tab" },
  TOGGLE_EVAL_BAR: { name: "Toggle Eval Bar and Arrows", keys: "z" },
};

export const keyMapAtom = atomWithStorage(
  "keybinds",
  keys,
  defaultStorage(keys, localStorage),
);

function defaultStorage<T>(
  keys: T,
  storage: SyncStringStorage,
): SyncStorage<T> {
  return {
    getItem(key, initialValue) {
      const storedValue = storage.getItem(key);
      if (storedValue === null) {
        return initialValue;
      }
      const parsed = JSON.parse(storedValue);
      for (const key in keys) {
        if (!(key in parsed)) {
          parsed[key] = keys[key];
        }
      }
      return parsed;
    },
    setItem(key, value) {
      storage.setItem(key, JSON.stringify(value));
    },
    removeItem(key) {
      storage.removeItem(key);
    },
  };
}
