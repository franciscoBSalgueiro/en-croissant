import {
    Chess,
    IllegalSetup,
    PositionError,
    Square,
    SquareName,
    makeSquare,
    squareFile,
    squareRank,
} from "chessops";
import { FenError, InvalidFen } from "chessops/fen";
import { match } from "ts-pattern";

export function squareToCoordinates(
    square: Square,
    orientation: "white" | "black"
) {
    let file = squareFile(square) + 1;
    let rank = squareRank(square) + 1;
    if (orientation === "black") {
        file = 9 - file;
        rank = 9 - rank;
    }
    return { file, rank };
}

export function positionErrorString(error: PositionError) {
    return match(error)
        .with({ message: IllegalSetup.Empty }, () => "Empty board")
        .with({ message: IllegalSetup.Kings }, () => "Invalid number of kings")
        .with({ message: IllegalSetup.OppositeCheck }, () => "Opposite check")
        .with(
            { message: IllegalSetup.PawnsOnBackrank },
            () => "Pawns on backrank"
        )
        .otherwise(() => "Unknown error");
}

export function invalidFenErrorString(error: FenError) {
    return match(error)
        .with( { message: InvalidFen.Board }, () => "Invalid board")
        .with( { message: InvalidFen.Castling }, () => "Invalid castling rights")
        .with( { message: InvalidFen.EpSquare }, () => "Invalid en passant square")
        .with( { message: InvalidFen.Fen }, () => "Invalid FEN")
        .with( { message: InvalidFen.Fullmoves }, () => "Invalid fullmove number")
        .with( { message: InvalidFen.Halfmoves }, () => "Invalid halfmove number")
        .with( { message: InvalidFen.Pockets }, () => "Invalid pockets")
        .with( { message: InvalidFen.RemainingChecks }, () => "Invalid remaining checks")
        .with( { message: InvalidFen.Turn }, () => "Invalid turn")
        .otherwise(() => "Unknown error");
}

export function forceEnPassant(dests: Map<SquareName, SquareName[]>, pos: Chess) {
    const epSquare = pos.epSquare ? makeSquare(pos.epSquare) : undefined;
    if (!epSquare) {
        return dests;
    }
    for (const [from, to] of dests.entries()) {
        let seen = false;
        if (to.includes(epSquare)) {
            seen = true;
            dests.set(from, [epSquare]);
        }
        if (!seen) {
            dests.delete(from);
        }
    }
    return dests;
}
