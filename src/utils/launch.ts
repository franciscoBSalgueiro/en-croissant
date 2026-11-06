import { notifications } from "@mantine/notifications";
import { error } from "@tauri-apps/plugin-log";
import { parsePGN } from "./chess";
import { openFile } from "./files";
import { getGameFromUrl } from "./import";
import { createTab, type Tab } from "./tabs";
import { getGameName } from "./treeReducer";

export async function openCommandLineFile(
    file: string,
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
    navigateToBoard: () => Promise<unknown>,
) {
    if (/^encroissant:/i.test(file)) return;
    try {
        await openFile(file, setTabs, setActiveTab);
        await navigateToBoard();
    } catch (e) {
        error(`Failed to open command-line file: ${file} - ${e}`);
        notifications.show({
            title: "Failed to open file",
            message: e instanceof Error ? e.message : String(e),
            color: "red",
        });
    }
}

export const handleDeepLink = async (
    urlStr: string,
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
    navigateToBoard: () => Promise<unknown>,
) => {
    let notificationShown = false;
    try {
        const url = new URL(urlStr);
        if (url.protocol !== "encroissant:") return;

        if (url.host === "import") {
            const gameUrl = url.searchParams.get("url");
            if (!gameUrl) {
                throw new Error("No URL parameter provided in encroissant://import");
            }

            notifications.show({
                title: "Importing game",
                message: `Loading game from ${gameUrl}...`,
                loading: true,
                autoClose: false,
                id: "importing-game-link",
            });
            notificationShown = true;

            const pgn = await getGameFromUrl(gameUrl);
            if (!pgn) {
                throw new Error("No PGN data found");
            }

            const tree = await parsePGN(pgn);
            const name = getGameName(tree.headers);

            await createTab({
                tab: {
                    name,
                    type: "analysis",
                },
                setTabs,
                setActiveTab,
                pgn,
            });

            await navigateToBoard();

            notifications.update({
                id: "importing-game-link",
                title: "Import successful",
                message: "Game imported successfully",
                color: "green",
                autoClose: 3000,
                loading: false,
            });
        }
    } catch (e) {
        error(`Failed to handle deep link URL: ${urlStr} - ${e}`);
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (notificationShown) {
            notifications.update({
                id: "importing-game-link",
                title: "Import failed",
                message: errorMessage,
                color: "red",
                autoClose: 5000,
                loading: false,
            });
        } else {
            notifications.show({
                title: "Import error",
                message: errorMessage,
                color: "red",
            });
        }
    }
};
