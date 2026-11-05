import { useAtom } from "jotai";
import { useEffect } from "react";
import { enginesAtom } from "@/state/atoms";
import { builtinStockfish } from "@/utils/stockfish";

const FLAG = "builtin-stockfish-added";

/** Adds the built-in Stockfish once, so analysis works out of the box (and on iOS at all). */
export function useBuiltinStockfish() {
    const [engines, setEngines] = useAtom(enginesAtom);
    useEffect(() => {
        if (engines === undefined) return;
        let added = false;
        try {
            added = localStorage.getItem(FLAG) === "1";
        } catch {
            // storage unavailable: fall back to checking the list only
        }
        if (added || engines.some((e) => e.type === "stockfish")) return;
        try {
            localStorage.setItem(FLAG, "1");
        } catch {
            // ignore
        }
        setEngines(async (prev) => [builtinStockfish(), ...(await prev)]);
    }, [engines, setEngines]);
}
