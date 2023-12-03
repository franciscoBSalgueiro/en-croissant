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
