import { FileMetadata } from "@/components/files/file";
import { getPGN, parsePGN } from "./chess";
import { GameHeaders, TreeNode } from "./treeReducer";
import { invoke } from "./invoke";
import { documentDir, resolve } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/api/dialog";

type TabType = "new" | "play" | "analysis" | "puzzles";

export type Tab = {
    name: string;
    value: string;
    type: TabType;
    gameNumber?: number;
    file?: FileMetadata;
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
    fileInfo?: FileMetadata;
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

export async function saveToFile({
    tab,
    root,
    headers,
    setCurrentTab,
    markAsSaved,
}: {
    tab: Tab | undefined;
    root: TreeNode;
    headers: GameHeaders;
    setCurrentTab: React.Dispatch<React.SetStateAction<Tab>>;
    markAsSaved: () => void;
}) {
    let filePath: string;
    if (tab?.file) {
        filePath = tab.file.path;
    } else {
        const defaultPath = await resolve(await documentDir(), "EnCroissant");
        const userChoice = await save({
            defaultPath,
            filters: [
                {
                    name: "PGN",
                    extensions: ["pgn"],
                },
            ],
        });
        if (userChoice === null) return;
        filePath = userChoice;
        setCurrentTab((prev) => {
            return {
                ...prev,
                file: {
                    name: userChoice,
                    path: userChoice,
                    numGames: 1,
                    metadata: {
                        tags: [],
                        type: "game",
                    },
                },
            };
        });
    }
    await invoke("write_game", {
        file: filePath,
        n: tab?.gameNumber || 0,
        pgn:
            getPGN(root, {
                headers,
            }) + "\n\n",
    });
    markAsSaved();
}
