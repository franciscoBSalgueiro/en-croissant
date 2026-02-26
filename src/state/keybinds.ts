import { platform } from "@tauri-apps/plugin-os";
import { atomWithStorage } from "jotai/utils";
import type {
  SyncStorage,
  SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";

const meta = platform() === "macos" ? "cmd" : "ctrl";

type Keybind = {
  name: string;
  keys: string;
};

type KeyMap = { [key: string]: Keybind };

const keys: KeyMap = {
  NEW_TAB: { name: "New tab", keys: `${meta}+t` },
  CLOSE_TAB: { name: "Close tab", keys: `${meta}+w` },
  OPEN_FILE: { name: "Open File", keys: `${meta}+o` },
  SAVE_FILE: { name: "Save File", keys: `${meta}+s` },
  SWAP_ORIENTATION: { name: "Swap orientation", keys: "f" },
  CLEAR_SHAPES: { name: "Clear shapes", keys: "ctrl+l" },
  NEXT_MOVE: { name: "Next move", keys: "arrowright" },
  PREVIOUS_MOVE: { name: "Previous move", keys: "arrowleft" },
  GO_TO_BRANCH_START: { name: "Go to start of branch", keys: "arrowup" },
  GO_TO_BRANCH_END: { name: "Go to end of branch", keys: "arrowdown" },
  GO_TO_START: { name: "Go to start of game", keys: "shift+arrowup" },
  GO_TO_END: { name: "Go to end of game", keys: "shift+down" },
  NEXT_BRANCH: { name: "Next branch", keys: "c" },
  PREVIOUS_BRANCH: { name: "Previous branch", keys: "x" },
  NEXT_BRANCHING: { name: "Next branching point", keys: "shift+arrowright" },
  PREVIOUS_BRANCHING: {
    name: "Previous branching point",
    keys: "shift+arrowleft",
  },
  DELETE_MOVE: { name: "Delete move", keys: "delete" },
  CYCLE_TABS: { name: "Cycle tabs", keys: "ctrl+tab" },
  REVERSE_CYCLE_TABS: { name: "Reverse cycle tabs", keys: "ctrl+shift+tab" },
  TOGGLE_EVAL_BAR: { name: "Toggle Eval Bar and Arrows", keys: "z" },
  PRACTICE_TAB: { name: "Go to practice tab", keys: "p" },
  ANALYSIS_TAB: { name: "Go to analysis tab", keys: "a" },
  DATABASE_TAB: { name: "Go to database tab", keys: "b" },
  ANNOTATE_TAB: { name: "Go to annotate tab", keys: "d" },
  INFO_TAB: { name: "Go to info tab", keys: "i" },
  ANNOTATION_BRILLIANT: { name: "Toggle brilliant move annotation", keys: "1" },
  ANNOTATION_GOOD: { name: "Toggle good move annotation", keys: "2" },
  ANNOTATION_INTERESTING: {
    name: "Toggle interesting move annotation",
    keys: "3",
  },
  ANNOTATION_DUBIOUS: { name: "Toggle dubious move annotation", keys: "4" },
  ANNOTATION_MISTAKE: { name: "Toggle mistake move annotation", keys: "5" },
  ANNOTATION_BLUNDER: { name: "Toggle blunder move annotation", keys: "6" },
  TOGGLE_ALL_ENGINES: { name: "Toggle all engines", keys: "ctrl+a" },
  TOGGLE_BLUR: { name: "Toggle blur", keys: "ctrl+b" },
  PREVIOUS_GAME: { name: "Previous game", keys: "pageup" },
  NEXT_GAME: { name: "Next game", keys: "pagedown" },
};

export const keyMapAtom = atomWithStorage(
  "keybinds",
  keys,
  defaultStorage(keys, localStorage),
);

function defaultStorage(
  defaults: KeyMap,
  storage: SyncStringStorage,
): SyncStorage<KeyMap> {
  return {
    getItem(key, initialValue) {
      const storedValue = storage.getItem(key);
      if (storedValue === null) {
        return initialValue;
      }
      const parsed = JSON.parse(storedValue);
      for (const key in defaults) {
        if (!(key in parsed)) {
          parsed[key] = defaults[key];
        }
      }
      return parsed;
    },
    setItem(key, value) {
      for (const subkey in value) {
        value[subkey].keys = value[subkey].keys.replace("meta", meta);
      }

      storage.setItem(key, JSON.stringify(value));
    },
    removeItem(key) {
      storage.removeItem(key);
    },
  };
}
