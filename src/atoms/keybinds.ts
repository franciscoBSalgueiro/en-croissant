import { atomWithStorage } from "jotai/utils";

export const keyMapAtom = atomWithStorage("keybinds", {
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
});
