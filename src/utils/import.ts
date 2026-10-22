import { getChesscomGame } from "./chess.com/api";
import { getLichessGameFromUrl } from "./lichess/api";

export async function getGameFromUrl(url: string): Promise<string> {
    // A site's name can be typed in any case (Chess.com, Lichess.org), a game's ID can't
    const site = url.toLowerCase();
    if (site.includes("chess.com")) {
        const res = await getChesscomGame(url);
        if (res === null) {
            throw new Error("Failed to load Chess.com game");
        }
        return res;
    } else if (site.includes("lichess.org")) {
        const res = await getLichessGameFromUrl(url);
        if (res === null) {
            throw new Error("Failed to load Lichess game");
        }
        return res;
    } else {
        throw new Error(`Failed to load game from unsupported URL: ${url}`);
    }
}
