import { getChesscomGame } from "./chess.com/api";
import { getLichessGame } from "./lichess/api";

export async function getGameFromUrl(url: string): Promise<string> {
    if (url.includes("chess.com")) {
        const res = await getChesscomGame(url);
        if (res === null) {
            throw new Error("Failed to load Chess.com game");
        }
        return res;
    } else if (url.includes("lichess.org")) {
        const excludedPathParts = ["game", "export", "white", "black"];
        const gameId = new URL(url).pathname
            .split("/")
            .find((x) => x && !excludedPathParts.includes(x));
        if (!gameId) {
            throw new Error("Failed to load lichess game: invalid URL");
        }
        return await getLichessGame(gameId);
    } else {
        throw new Error(`Failed to load game from unsupported URL: ${url}`);
    }
}
