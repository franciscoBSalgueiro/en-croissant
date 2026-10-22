import { getChesscomGame } from "./chess.com/api";
import { getLichessGameFromUrl } from "./lichess/api";

export async function getGameFromUrl(url: string): Promise<string> {
    if (url.includes("chess.com")) {
        const res = await getChesscomGame(url);
        if (res === null) {
            throw new Error("Failed to load Chess.com game");
        }
        return res;
    } else if (url.includes("lichess.org")) {
        const res = await getLichessGameFromUrl(url);
        if (res === null) {
            throw new Error("Failed to load Lichess game");
        }
        return res;
    } else {
        throw new Error(`Failed to load game from unsupported URL: ${url}`);
    }
}
