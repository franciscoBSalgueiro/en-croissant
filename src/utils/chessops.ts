import {
  Chess,
  type Color,
  IllegalSetup,
  type Move,
  type PositionError,
  type Setup,
  type Square,
  type SquareName,
  SquareSet,
  makeSquare,
  parseUci,
  squareFile,
  squareRank,
} from "chessops";
import { type FenError, InvalidFen, makeFen, parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { squareFromCoords } from "chessops/util";
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
    .with({ message: IllegalSetup.Empty }, () => "Errors.EmptyBoard")
    .with({ message: IllegalSetup.Kings }, () => "Errors.InvalidKings")
    .with({ message: IllegalSetup.OppositeCheck }, () => "Errors.OppositeCheck")
    .with(
      { message: IllegalSetup.PawnsOnBackrank },
      () => "Errors.PawnsOnBackrank",
    )
    .with({ message: InvalidFen.Board }, () => "Errors.InvalidBoard")
    .with(
      { message: InvalidFen.Castling },
      () => "Errors.InvalidCastlingRights",
    )
    .with({ message: InvalidFen.EpSquare }, () => "Errors.InvalidEpSquare")
    .with({ message: InvalidFen.Fen }, () => "Errors.InvalidFen")
    .with({ message: InvalidFen.Fullmoves }, () => "Errors.InvalidFullmoves")
    .with({ message: InvalidFen.Halfmoves }, () => "Errors.InvalidHalfmoves")
    .with({ message: InvalidFen.Pockets }, () => "Errors.InvalidPockets")
    .with(
      { message: InvalidFen.RemainingChecks },
      () => "Errors.InvalidRemainingChecks",
    )
    .with({ message: InvalidFen.Turn }, () => "Errors.InvalidTurn")
    .otherwise(() => "Errors.Unknown");
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

export function getCastlingSquare(
  setup: Setup,
  color: "w" | "b",
  side: "q" | "k",
) {
  const kingSquare = (color === "w" ? setup.board.white : setup.board.black)
    .intersect(setup.board.king)
    .singleSquare();
  if (kingSquare === undefined) {
    return;
  }

  let possibleRookSquares = SquareSet.empty();
  for (let file = 0; file < 8; file++) {
    const newSquare = squareFromCoords(file, squareRank(kingSquare));
    if (newSquare === undefined) {
      continue;
    }
    if (side === "q" && file < squareFile(kingSquare)) {
      possibleRookSquares = possibleRookSquares.set(newSquare, true);
    } else if (side === "k" && file > squareFile(kingSquare)) {
      possibleRookSquares = possibleRookSquares.set(newSquare, true);
    }
  }

  const rookSquares = (color === "w" ? setup.board.white : setup.board.black)
    .intersect(setup.board.rook)
    .intersect(possibleRookSquares);

  return rookSquares.first();
}
