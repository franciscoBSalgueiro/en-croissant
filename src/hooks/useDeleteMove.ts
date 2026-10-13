import { useAtomValue } from "jotai";
import { useCallback, useContext } from "react";
import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { currentGameIdAtom, currentGameStateAtom, currentTabAtom } from "@/state/atoms";

export function useDeleteMove() {
    const store = useContext(TreeStateContext)!;
    const tab = useAtomValue(currentTabAtom);
    const gameState = useAtomValue(currentGameStateAtom);
    const gameId = useAtomValue(currentGameIdAtom);

    return useCallback(
        async (path?: number[]) => {
            const movePath = path ?? store.getState().position;
            if (movePath.length === 0) return;

            if (tab?.type === "play" && gameState === "playing") {
                if (!gameId || movePath.some((index) => index !== 0)) return;
                try {
                    const result = await commands.takeBackGameMove(gameId, movePath.length - 1);
                    if (result.status === "error") {
                        console.error("Failed to delete game move:", result.error);
                        return;
                    }
                } catch (error) {
                    console.error("Failed to delete game move:", error);
                    return;
                }
            }

            store.getState().deleteMove(movePath);
        },
        [store, tab?.type, gameState, gameId],
    );
}
