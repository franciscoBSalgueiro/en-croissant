import { getPgnHeaders, parsePGN } from "./chess";
import { GameHeaders } from "./treeReducer";

type TabType = "new" | "play" | "analysis" | "puzzles";

export interface Tab {
    name: string;
    value: string;
    type: TabType;
    file?: string;
    gameNumber?: number;
}

export function genID() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return S4() + S4();
}

export function createTab({
    tab,
    setTabs,
    setActiveTab,
    pgn,
    headers,
}: {
    tab: Omit<Tab, "value">;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
    pgn?: string;
    headers?: GameHeaders;
}) {
    const id = genID();

    if (pgn) {
        const tree = parsePGN(pgn);
        tree.headers = headers || getPgnHeaders(pgn);
        sessionStorage.setItem(id, JSON.stringify(tree));
    }

    setTabs((prev) => [
        ...prev,
        {
            ...tab,
            value: id,
        },
    ]);
    setActiveTab(id);
    return id;
}
