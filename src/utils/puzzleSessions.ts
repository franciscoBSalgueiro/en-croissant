import type { Puzzle } from "./puzzles";

export interface PuzzleSession {
    id: string;
    startedAt: number;
    updatedAt: number;
    database: string | null;
    puzzles: Puzzle[];
}

export function savePuzzleSession(
    sessions: PuzzleSession[],
    id: string,
    puzzles: Puzzle[],
    database: string | null,
    now: number,
): PuzzleSession[] {
    if (puzzles.length === 0) return sessions;
    const previous = sessions.find((session) => session.id === id);
    const session: PuzzleSession = {
        id,
        startedAt: previous?.startedAt ?? now,
        updatedAt: now,
        database: previous?.database ?? database,
        // The training view mutates puzzle results; history must own its snapshots.
        puzzles: puzzles.map((puzzle) => ({
            ...puzzle,
            moves: [...puzzle.moves],
            themes: puzzle.themes ? [...puzzle.themes] : undefined,
        })),
    };
    return previous
        ? sessions.map((entry) => (entry.id === id ? session : entry))
        : [...sessions, session];
}

export function puzzleSessionStats(puzzles: Puzzle[]) {
    const correct = puzzles.filter((puzzle) => puzzle.completion === "correct").length;
    const incorrect = puzzles.filter((puzzle) => puzzle.completion === "incorrect").length;
    const completed = correct + incorrect;
    return {
        correct,
        incorrect,
        completed,
        accuracy: completed ? Math.round((correct / completed) * 100) : null,
        timeSpent: puzzles.reduce((total, puzzle) => total + (puzzle.timeSpent ?? 0), 0),
    };
}

export function puzzleSessionDay(timestamp: number) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function groupPuzzleSessionsByDay(sessions: PuzzleSession[]) {
    const groups = new Map<string, { day: string; timestamp: number; sessions: PuzzleSession[] }>();
    for (const session of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
        const day = puzzleSessionDay(session.startedAt);
        const group = groups.get(day);
        if (group) group.sessions.push(session);
        else groups.set(day, { day, timestamp: session.startedAt, sessions: [session] });
    }
    return [...groups.values()];
}
