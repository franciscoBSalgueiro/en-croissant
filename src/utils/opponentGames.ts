import { fetch } from "@tauri-apps/plugin-http";
import { makeUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import { parsePGN } from "@/utils/chess";
import { apiHeaders } from "@/utils/http";
import type { OpponentGame } from "@/utils/opponent";

const GAMES_USER_URL = "https://lichess.org/api/games/user";
const MAX_GAMES = 100;

/** Variants whose moves can safely be replayed from the initial position. */
const STANDARD_VARIANTS = new Set(["standard", "from position", "chess"]);

/**
 * Fetches the raw multi-game PGN export of a user's most recent games from
 * the public Lichess API (no authentication required).
 */
export async function fetchLichessGamesPgn(username: string, max = MAX_GAMES): Promise<string> {
    const url = `${GAMES_USER_URL}/${encodeURIComponent(username.trim())}?max=${max}&moves=true&pgnInJson=false&clocks=false&evals=false`;
    const response = await fetch(url, {
        headers: apiHeaders({ Accept: "application/x-chess.pgn" }),
    });
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.text();
}

/**
 * Splits a multi-game PGN export into individual game PGNs. A game boundary
 * is a blank line followed by a new header block; the blank line between a
 * game's headers and its movetext is never followed by `[Event`, so it does
 * not split there.
 */
export function splitPgnGames(pgn: string): string[] {
    return pgn
        .split(/\n\s*\n(?=\s*\[Event\b)/)
        .map((game) => game.trim())
        .filter((game) => game.length > 0);
}

/**
 * Converts a single standard-variant PGN into an `OpponentGame` (main line
 * moves as space separated UCI strings), using the same lexer/parser the
 * rest of the app uses for PGN imports. Returns `null` when the given user
 * did not play the game, when it uses a non-standard variant, or when it
 * contains no moves.
 */
export async function pgnToOpponentGame(
    pgn: string,
    username: string,
): Promise<OpponentGame | null> {
    const tree = await parsePGN(pgn);
    const { headers } = tree;

    const variant = (headers.variant ?? "Standard").toLowerCase();
    if (!STANDARD_VARIANTS.has(variant)) {
        return null;
    }

    const name = username.trim().toLowerCase();
    const isWhite = headers.white.toLowerCase() === name;
    const isBlack = headers.black.toLowerCase() === name;
    if (!isWhite && !isBlack) {
        return null;
    }

    const ucis: string[] = [];
    let node = tree.root;
    while (node.children.length > 0) {
        node = node.children[0];
        if (node.move) {
            ucis.push(makeUci(node.move));
        }
    }
    if (ucis.length === 0) {
        return null;
    }

    return {
        fen: headers.fen !== INITIAL_FEN ? headers.fen : undefined,
        moves: ucis.join(" "),
        elo: isWhite ? headers.white_elo : headers.black_elo,
    };
}

/**
 * Fetches and parses the recent games of a Lichess user into the shape
 * expected by `buildOpponentBook`. Malformed games are skipped.
 */
export async function fetchOpponentGames(
    username: string,
    max = MAX_GAMES,
): Promise<OpponentGame[]> {
    const pgn = await fetchLichessGamesPgn(username, max);
    const games: OpponentGame[] = [];
    for (const raw of splitPgnGames(pgn)) {
        try {
            const game = await pgnToOpponentGame(raw, username);
            if (game) {
                games.push(game);
            }
        } catch (err) {
            console.error("Failed to parse PGN game:", err);
        }
    }
    return games;
}
