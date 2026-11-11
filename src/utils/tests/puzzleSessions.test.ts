import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { puzzleSessionFamily, puzzleSessionsAtom } from "@/state/puzzleSessions";
import type { Puzzle } from "../puzzles";
import {
    groupPuzzleSessionsByDay,
    puzzleSessionDay,
    puzzleSessionStats,
    savePuzzleSession,
} from "../puzzleSessions";

const puzzle = (id = 1): Puzzle => ({
    id,
    fen: "8/8/8/8/8/2k5/8/K7 w - - 0 1",
    moves: ["a1a2"],
    rating: 1200,
    rating_deviation: 60,
    popularity: 80,
    nb_plays: 20,
    completion: "incomplete",
});

function memoryStorage(): Storage {
    const values = new Map<string, string>();
    return {
        get length() {
            return values.size;
        },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
        clear: () => values.clear(),
    };
}

beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());
});

function historyStore() {
    const store = createStore();
    store.sub(puzzleSessionsAtom, () => {});
    return store;
}

describe("persistent puzzle sessions", () => {
    it("updates one session instead of duplicating it and preserves its start date", () => {
        const initial = savePuzzleSession([], "session", [puzzle()], "puzzles.db3", 1000);
        const next = savePuzzleSession(
            initial,
            "session",
            [{ ...puzzle(), completion: "correct", timeSpent: 4200 }],
            "puzzles.db3",
            2000,
        );
        expect(next).toHaveLength(1);
        expect(next[0].startedAt).toBe(1000);
        expect(next[0].updatedAt).toBe(2000);
        expect(initial[0].puzzles[0].completion).toBe("incomplete");
    });

    it("owns its snapshot even when the training view mutates results", () => {
        const current = puzzle();
        const sessions = savePuzzleSession([], "session", [current], null, 1000);
        current.completion = "incorrect";
        current.moves.push("c3c4");
        expect(sessions[0].puzzles[0].completion).toBe("incomplete");
        expect(sessions[0].puzzles[0].moves).toEqual(["a1a2"]);
    });

    it("keeps earlier sessions when starting a new one and across app restarts", () => {
        const store = historyStore();
        const active = puzzleSessionFamily("history-restart");
        store.set(active, { value: [puzzle()], database: "puzzles.db3" });
        store.set(active, {
            value: (previous) => previous.map((p) => ({ ...p, completion: "correct" })),
            database: "puzzles.db3",
        });
        store.set(active, { value: [], database: "puzzles.db3" });
        expect(store.get(active)).toEqual([]);
        expect(store.get(puzzleSessionsAtom)).toHaveLength(1);
        store.set(active, { value: [puzzle(2)], database: "puzzles.db3" });
        expect(store.get(puzzleSessionsAtom)).toHaveLength(2);
        window.sessionStorage.clear();
        const restarted = historyStore();
        expect(restarted.get(puzzleSessionsAtom)).toHaveLength(2);
        expect(restarted.get(puzzleSessionsAtom)[0].puzzles[0].completion).toBe("correct");
    });

    it("keeps simultaneous puzzle tabs in separate sessions", () => {
        const store = historyStore();
        store.set(puzzleSessionFamily("tab-one"), { value: [puzzle()], database: "one.db3" });
        store.set(puzzleSessionFamily("tab-two"), { value: [puzzle(2)], database: "two.db3" });
        expect(store.get(puzzleSessionsAtom).map((s) => s.database)).toEqual([
            "one.db3",
            "two.db3",
        ]);
    });

    it("imports the existing in-progress exercises without losing them", () => {
        sessionStorage.setItem("legacy-puzzles", JSON.stringify([puzzle()]));
        const store = historyStore();
        const active = puzzleSessionFamily("legacy");
        expect(store.get(active)).toHaveLength(1);
        store.set(active, { value: (previous) => previous, database: null });
        expect(store.get(puzzleSessionsAtom)[0].puzzles).toEqual([puzzle()]);
    });

    it("calculates accuracy from completed exercises only", () => {
        expect(
            puzzleSessionStats([
                { ...puzzle(), completion: "correct", timeSpent: 1000 },
                { ...puzzle(2), completion: "incorrect", timeSpent: 2000 },
                puzzle(3),
            ]),
        ).toEqual({ correct: 1, incorrect: 1, completed: 2, accuracy: 50, timeSpent: 3000 });
        expect(puzzleSessionStats([]).accuracy).toBeNull();
    });
});

it("groups sessions by local calendar day and sorts dates and sessions newest first", () => {
    const session = (id: string, startedAt: number) => ({
        id,
        startedAt,
        updatedAt: startedAt,
        database: null,
        puzzles: [puzzle()],
    });
    const earlier = session("yesterday", new Date(2026, 9, 13, 23, 59).getTime());
    const first = session("first", new Date(2026, 9, 14, 0, 1).getTime());
    const latest = session("latest", new Date(2026, 9, 14, 11).getTime());
    const groups = groupPuzzleSessionsByDay([earlier, first, latest]);
    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe(puzzleSessionDay(first.startedAt));
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["latest", "first"]);
    expect(groups[1].sessions.map((s) => s.id)).toEqual(["yesterday"]);
});
