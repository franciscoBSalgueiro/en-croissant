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
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return S4() + S4();
}

export function createTab({
    name,
    type,
    setTabs,
    setActiveTab,
    pgn,
    headers,
}: {
    name: string;
    type: TabType;
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
            name,
            value: id,
            type,
        },
    ]);
    setActiveTab(id);
    return id;
}
