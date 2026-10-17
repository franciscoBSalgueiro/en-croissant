import { type Chess, makeUci, parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { positionFromFen } from "./chessops";

export type BookMove = { uci: string; san: string; weight: number };
export type OpponentBook = { maxPly: number; positions: Record<string, BookMove[]> };

export type OpponentGame = {
    fen?: string | null;
    moves: string;
    elo?: number | null;
};

function positionKey(pos: Chess): string {
    // Mirrors the Rust backend (src-tauri/src/game.rs), which keys the book
    // with shakmaty `Fen::from_position(position, EnPassantMode::Legal)`
    // followed by `fen.split_whitespace().take(4)` (placement, turn,
    // castling, ep).
    //
    // chessops' `makeFen(setup)` writes `setup.epSquare` verbatim, and
    // `play()` sets it after every double pawn push (shakmaty's
    // `EnPassantMode::PseudoLegal`). `pos.toSetup()` however normalizes the
    // ep square through `legalEpSquare()`, keeping it only when an en
    // passant capture is actually legal, which matches
    // `EnPassantMode::Legal`, so `makeFen(pos.toSetup())` produces the same
    // keys as the Rust side.
    return makeFen(pos.toSetup()).split(" ").slice(0, 4).join(" ");
}

export function buildOpponentBook(
    games: OpponentGame[],
    maxPly: number,
): {
    book: OpponentBook;
    playerCount: number;
    avgElo?: number;
} {
    const positions: Record<string, BookMove[]> = {};

    for (const game of games) {
        const [pos, error] = positionFromFen(game.fen ?? INITIAL_FEN);
        if (error) {
            continue;
        }

        const ucis = game.moves
            .trim()
            .split(/\s+/)
            .filter((uci) => uci.length > 0);
        for (let ply = 0; ply < ucis.length && ply < maxPly; ply++) {
            const move = parseUci(ucis[ply]);
            if (!move || !pos.isLegal(move)) {
                // Corrupt or illegal move list: the remaining plies of this
                // game cannot be trusted.
                break;
            }

            const key = positionKey(pos);
            const uci = makeUci(move);
            // The SAN is computed from the position before the move is
            // played; `makeSanAndPlay` plays the move afterwards.
            const san = makeSanAndPlay(pos, move);

            const moves = (positions[key] ??= []);
            const existing = moves.find((bookMove) => bookMove.uci === uci);
            if (existing) {
                existing.weight += 1;
            } else {
                moves.push({ uci, san, weight: 1 });
            }
        }
    }

    return {
        book: { maxPly, positions },
        playerCount: games.length,
        avgElo: opponentElo(games.map((game) => game.elo)),
    };
}

export function opponentElo(elos: (number | null | undefined)[]): number | undefined {
    const valid = elos.filter((elo): elo is number => typeof elo === "number");
    if (valid.length === 0) {
        return undefined;
    }
    const total = valid.reduce((sum, elo) => sum + elo, 0);
    return Math.round(total / valid.length);
}
