import {
  Chess,
  Move,
  NormalMove,
  Role,
  Square,
  SquareSet,
  attacks,
  isNormal,
  makeSquare,
  makeUci,
  parseSquare,
} from "chessops";
import { match } from "ts-pattern";
import { joinWithAnd } from "./format";

export type Comment = {
  text: string;
  arrows: string[];
};

function getPieceValue(role: Role) {
  return match(role)
    .with("pawn", () => 1)
    .with("knight", () => 3)
    .with("bishop", () => 3)
    .with("rook", () => 5)
    .with("queen", () => 9)
    .with("king", () => 100)
    .exhaustive();
}

export function getComment(pos: Chess, move: Move): Comment | null {
  if (!isNormal(move)) return null;
  let text = "";
  const arrows: string[] = [];
  const nextPos = pos.clone();
  nextPos.play(move);

  if (nextPos.isEnd()) return null;

  const isCapture = pos.board.get(move.to) !== undefined;

  const piece = nextPos.board.get(move.to)!;
  if (!piece) return null;

  const prevAttackedBy = getAttackers(pos, move.from);
  const prevAttackedByPieces = prevAttackedBy.map((s) => pos.board.get(s)!);

  const attackedBy = getAttackers(nextPos, move.to);
  const attackedByPieces = attackedBy.map((s) => nextPos.board.get(s)!);

  const lessValuableAttacker = attackedByPieces.findIndex(
    (p) => getPieceValue(p.role) < getPieceValue(piece.role),
  );
  if (lessValuableAttacker !== -1) {
    text += `This move is a sacrifice, as the ${
      piece.role
    } can be captured by the ${
      nextPos.board.get(attackedBy[lessValuableAttacker])?.role
    } on ${makeSquare(attackedBy[lessValuableAttacker])}. `;
    arrows.push(
      `${makeSquare(attackedBy[lessValuableAttacker])}${makeSquare(move.to)}`,
    );
  }

  const prevAttacked = attacks(piece, move.from, pos.board.occupied).intersect(
    piece.color === "white" ? pos.board.black : pos.board.white,
  );
  const attacked = attacks(piece, move.to, nextPos.board.occupied).intersect(
    piece.color === "white" ? nextPos.board.black : nextPos.board.white,
  );
  const prevDefended = attacks(piece, move.from, pos.board.occupied).intersect(
    piece.color === "white" ? pos.board.white : pos.board.black,
  );
  const defended = attacks(piece, move.to, nextPos.board.occupied).intersect(
    piece.color === "white" ? nextPos.board.white : nextPos.board.black,
  );

  const newlyAttacked = attacked.diff(prevAttacked);
  const newlyDefended = defended.diff(prevDefended);

  for (const square of newlyAttacked) {
    const defenderSquares = getDefenders(nextPos, square);
    const defenderPieces = defenderSquares.map((s) => nextPos.board.get(s)!);
    if (
      defenderSquares.length > 0 ||
      !defenderPieces.some(
        (p) => getPieceValue(p.role) <= getPieceValue(piece.role),
      )
    ) {
      text += `This move attacks the ${
        nextPos.board.get(square)?.role
      } on ${makeSquare(square)}. `;
      arrows.push(`${makeSquare(move.to)}${makeSquare(square)}`);
    }
  }

  const switchedPos = nextPos.clone();
  switchedPos.turn = switchedPos.turn === "white" ? "black" : "white";
  const legalMoves = switchedPos.allDests();
  if (!nextPos.isCheck()) {
    for (const [orig, dests] of legalMoves) {
      for (const dest of dests) {
        const move = { from: orig, to: dest };
        const newPos = switchedPos.clone();
        newPos.play(move);
        if (newPos.isCheckmate()) {
          text += `This move threatens checkmate on ${makeSquare(dest)}. `;
          arrows.push(`${makeSquare(orig)}${makeSquare(dest)}`);
        }
      }
    }
  }

  if (isFianchetto(pos, move)) {
    text += "This move fianchettoes the bishop, controlling the long diagonal.";
  } else if (developsPiece(pos, move)) {
    nextPos.turn = nextPos.turn === "white" ? "black" : "white";
    text += `This move develops the ${nextPos.board.get(move.to)?.role}.`;
  }
  if (text === "") return null;
  return { text, arrows };
}

function isFianchetto(pos: Chess, move: NormalMove) {
  const piece = pos.board.get(move.from)?.role;
  const uci = makeUci(move);

  if (piece === "bishop" && (uci === "f1g2" || uci === "f8g7")) {
    return true;
  }
  return false;
}

function developsPiece(pos: Chess, move: NormalMove) {
  const piece = pos.board.get(move.from)?.role;

  if (
    piece === "knight" &&
    (move.from === parseSquare("b1") ||
      move.from === parseSquare("g1") ||
      move.from === parseSquare("b8") ||
      move.from === parseSquare("g8"))
  ) {
    return true;
  }
  if (
    piece === "bishop" &&
    (move.from === parseSquare("c1") ||
      move.from === parseSquare("f1") ||
      move.from === parseSquare("c8") ||
      move.from === parseSquare("f8"))
  ) {
    return true;
  }
  return false;
}

function getAttackers(pos: Chess, square: Square) {
  const piece = pos.board.get(square);
  if (!piece) return [];
  const possibleAttackers =
    piece.color === "white" ? pos.board.black : pos.board.white;
  const attackers = [];
  for (const attacker of possibleAttackers) {
    const attack = attacks(
      pos.board.get(attacker)!,
      attacker,
      pos.board.occupied,
    );
    if (attack.has(square)) {
      attackers.push(attacker);
    }
  }
  return attackers;
}

function getDefenders(pos: Chess, square: Square) {
  const piece = pos.board.get(square);
  if (!piece) return [];
  const possibleDefenders =
    piece.color === "white" ? pos.board.white : pos.board.black;
  const defenders = [];
  for (const defender of possibleDefenders) {
    const attack = attacks(
      pos.board.get(defender)!,
      defender,
      pos.board.occupied,
    );
    if (attack.has(square)) {
      defenders.push(defender);
    }
  }
  return defenders;
}

export function getTension(pos: Chess) {
  const white = pos.board.white;
  const black = pos.board.black;
  const attackedWhitePieces = new Set<Square>();
  for (const square of black) {
    const piece = pos.board.get(square);
    if (!piece) continue;
    const attack = attacks(piece, square, pos.board.occupied).intersect(white);
    for (const square of attack) {
      attackedWhitePieces.add(square);
    }
  }
  const switchPos = pos.clone();
  switchPos.turn = switchPos.turn === "white" ? "black" : "white";
  const attackedBlackPieces = new Set<Square>();
  for (const square of white) {
    const piece = switchPos.board.get(square);
    if (!piece) continue;
    const attack = attacks(piece, square, switchPos.board.occupied).intersect(
      black,
    );
    for (const square of attack) {
      attackedBlackPieces.add(square);
    }
  }
  const whiteTension = Array.from(attackedWhitePieces).map(
    (s) => {
      if (SquareSet.center().has(s)) {
        return 2;
      }
      return 1;
    },
    // getPieceValue(pos.board.get(s)!.role),
  );
  const blackTension = Array.from(attackedBlackPieces).map(
    (s) => {
      if (SquareSet.center().has(s)) {
        return 2;
      }
      return 1;
    },
    // getPieceValue(switchPos.board.get(s)!.role),
  );
  //   console.log("attackedWhitePieces", attackedWhitePieces);
  //   console.log("attackedBlackPieces", attackedBlackPieces);
  return ((sum(whiteTension) + sum(blackTension)) / 16) * 100;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}
