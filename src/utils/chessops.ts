import {
  Chess,
  Color,
  IllegalSetup,
  Move,
  PositionError,
  Square,
  SquareName,
  makeSquare,
  parseUci,
  squareFile,
  squareRank,
} from "chessops";
import { FenError, InvalidFen, makeFen, parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { match } from "ts-pattern";

export function positionFromFen(
  fen: string,
): [Chess, null] | [null, FenError | PositionError] {
  const [setup, error] = parseFen(fen).unwrap(
    (v) => [v, null],
    (e) => [null, e],
  );
  if (error) {
    return [null, error];
  }

  return Chess.fromSetup(setup).unwrap(
    (v) => [v, null],
    (e) => [null, e],
  );
}

export function swapMove(fen: string, color?: Color) {
  const setup = parseFen(fen).unwrap();
  if (color) {
    setup.turn = color;
  } else {
    setup.turn = setup.turn === "white" ? "black" : "white";
  }

  return makeFen(setup);
}

export function squareToCoordinates(
  square: Square,
  orientation: "white" | "black",
) {
  let file = squareFile(square) + 1;
  let rank = squareRank(square) + 1;
  if (orientation === "black") {
    file = 9 - file;
    rank = 9 - rank;
  }
  return { file, rank };
}

export function chessopsError(error: PositionError | FenError) {
  return match(error)
    .with({ message: IllegalSetup.Empty }, () => "Empty board")
    .with({ message: IllegalSetup.Kings }, () => "Invalid number of kings")
    .with({ message: IllegalSetup.OppositeCheck }, () => "Opposite check")
    .with({ message: IllegalSetup.PawnsOnBackrank }, () => "Pawns on backrank")
    .with({ message: InvalidFen.Board }, () => "Invalid board")
    .with({ message: InvalidFen.Castling }, () => "Invalid castling rights")
    .with({ message: InvalidFen.EpSquare }, () => "Invalid en passant square")
    .with({ message: InvalidFen.Fen }, () => "Invalid FEN")
    .with({ message: InvalidFen.Fullmoves }, () => "Invalid fullmove number")
    .with({ message: InvalidFen.Halfmoves }, () => "Invalid halfmove number")
    .with({ message: InvalidFen.Pockets }, () => "Invalid pockets")
    .with(
      { message: InvalidFen.RemainingChecks },
      () => "Invalid remaining checks",
    )
    .with({ message: InvalidFen.Turn }, () => "Invalid turn")
    .otherwise(() => "Unknown error");
}

export function forceEnPassant(
  dests: Map<SquareName, SquareName[]>,
  pos: Chess,
) {
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

export function getPiecesCount(pos: Chess) {
  return (
    pos.board.pawn.size() +
    pos.board.knight.size() +
    pos.board.bishop.size() +
    pos.board.rook.size() +
    pos.board.queen.size() +
    pos.board.king.size()
  );
}

export function hasCaptures(pos: Chess) {
  const dests = pos.allDests();
  for (const to of dests.values()) {
    for (const square of to) {
      if (pos.board.get(square)) {
        return true;
      }
    }
  }
  return false;
}

export function parseSanOrUci(pos: Chess, sanOrUci: string): Move | null {
  const sanParsed = parseSan(pos, sanOrUci);
  if (sanParsed) {
    return sanParsed;
  }

  const uciParsed = parseUci(sanOrUci);
  if (uciParsed) {
    return uciParsed;
  }

  return null;
}
