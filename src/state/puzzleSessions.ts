import { atom, type SetStateAction } from "jotai";
import { atomFamily, atomWithStorage, createJSONStorage } from "jotai/utils";
import type { Puzzle } from "@/utils/puzzles";
import { type PuzzleSession, savePuzzleSession } from "@/utils/puzzleSessions";

export const puzzleSessionsAtom = atomWithStorage<PuzzleSession[]>(
    "puzzle-session-history",
    [],
    undefined,
    { getOnInit: true },
);

export const puzzleSessionFamily = atomFamily((tabId: string) => {
    // Retain the existing storage key to preserve exercises already in progress.
    const puzzles = atomWithStorage<Puzzle[]>(
        `${tabId}-puzzles`,
        [],
        createJSONStorage(() => sessionStorage),
        { getOnInit: true },
    );
    const activeSession = atomWithStorage<string | null>(
        `${tabId}-puzzle-session`,
        null,
        createJSONStorage(() => sessionStorage),
        { getOnInit: true },
    );
    return atom(
        (get) => get(puzzles),
        (get, set, update: { value: SetStateAction<Puzzle[]>; database: string | null }) => {
            const previous = get(puzzles);
            const next = typeof update.value === "function" ? update.value(previous) : update.value;
            const sessionId = get(activeSession) ?? crypto.randomUUID();
            const snapshot = next.length ? next : previous;
            if (snapshot.length) {
                set(puzzleSessionsAtom, (sessions) =>
                    savePuzzleSession(sessions, sessionId, snapshot, update.database, Date.now()),
                );
            }
            set(activeSession, next.length ? sessionId : null);
            set(puzzles, next);
        },
    );
});
