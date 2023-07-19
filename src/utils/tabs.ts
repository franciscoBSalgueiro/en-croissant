import { parsePGN } from "./chess";
import { GameHeaders } from "./treeReducer";

type TabType = "new" | "play" | "analysis" | "puzzles";

export type Tab = {
    name: string;
    value: string;
    type: TabType;
    gameNumber?: number;
    file?: FileInfo;
};

export type FileInfo = {
    path: string;
    numGames: number;
};

export function genID() {
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return S4() + S4();
}

export async function createTab({
    tab,
    setTabs,
    setActiveTab,
    pgn,
    headers,
    fileInfo,
}: {
    tab: Omit<Tab, "value">;
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
    pgn?: string;
    headers?: GameHeaders;
    fileInfo?: FileInfo;
}) {
    const id = genID();

    if (pgn) {
        const tree = await parsePGN(pgn);
        if (headers) {
            tree.headers = headers;
        }
        sessionStorage.setItem(id, JSON.stringify(tree));
    }

    setTabs((prev) => [
        ...prev,
        {
            ...tab,
            value: id,
            file: fileInfo,
        },
    ]);
    setActiveTab(id);
    return id;
}
