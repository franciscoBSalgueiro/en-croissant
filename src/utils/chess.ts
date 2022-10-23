import { Chess, Move, SQUARES } from "chess.ts";
import { Key } from "chessground/types";

export class VariationTree {
  parent: VariationTree | null;
  position: Chess;
  children: VariationTree[];
  constructor(
    parent: VariationTree | null,
    position: Chess,
    children?: VariationTree[]
  ) {
    this.parent = parent;
    this.position = position;
    this.children = children ?? [];
  }

  equals(other: VariationTree): boolean {
    return this.position.pgn() === other.position.pgn();
  }

  getTopVariation(): VariationTree {
    if (this.parent === null) {
      return this;
    }
    return this.parent.getTopVariation();
  }

  getBottomVariation(): VariationTree {
    if (this.children.length === 0) {
      return this;
    }
    return this.children[0].getBottomVariation();
  }

  getLastMove(): Move | null {
    return getLastChessMove(this.position);
  }

  isInBranch(tree: VariationTree): boolean {
    if (this.equals(tree)) {
      return true;
    }
    if (this.parent === null) {
      return false;
    }
    return this.parent.isInBranch(tree);
  }
}

export function moveToKey(move: Move | null) {
  return move ? ([move.from, move.to] as Key[]) : undefined;
}

export function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map();
  Object.keys(SQUARES).forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length)
      dests.set(
        s,
        ms.map((m) => m.to)
      );
  });
  return dests;
}

export function formatMove(orientation: string) {
  return orientation === "w" ? "white" : "black";
}

export function getLastChessMove(chess: Chess): Move | null {
  return chess.history({ verbose: true }).slice(-1)[0] || null;
}
