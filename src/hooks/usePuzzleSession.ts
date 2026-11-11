import { useAtom, type SetStateAction } from "jotai";
import { useCallback, useEffect } from "react";
import { puzzleSessionFamily } from "@/state/puzzleSessions";
import type { Puzzle } from "@/utils/puzzles";

export function usePuzzleSession(tabId: string, database: string | null) {
    const [puzzles, update] = useAtom(puzzleSessionFamily(tabId));
    const setPuzzles = useCallback(
        (value: SetStateAction<Puzzle[]>) => update({ value, database }),
        [update, database],
    );
    // Also save sessions that were already underway before history was introduced.
    useEffect(() => {
        setPuzzles((previous) => previous);
    }, [setPuzzles]);
    return [puzzles, setPuzzles] as const;
}
