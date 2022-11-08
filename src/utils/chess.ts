import { Chess, Move, SQUARES } from "chess.ts";
import { Key } from "chessground/types";

export interface EngineVariation {
  moves: string[];
  score: number;
  depth: number;
}

export class VariationTree {
  parent: VariationTree | null;
  pgn: string;
  chess: Chess;
  lastMove: Move | null;
  children: VariationTree[];
  score: number;
  depth: number;

  constructor(
    parent: VariationTree | null,
    position: string,
    children?: VariationTree[],
    score?: number,
    depth?: number
  ) {
    this.parent = parent;
    this.pgn = position;
    this.children = children ?? [];
    this.score = score ?? 0;
    this.depth = depth ?? 0;
    const chess = new Chess();
    chess.loadPgn(position);
    this.chess = chess;
    const history = chess.history({ verbose: true });
    if (history.length === 0) {
      this.lastMove = null;
    } else {
      this.lastMove = history[history.length - 1];
    }
  }

  equals(other: VariationTree): boolean {
    return this.pgn === other.pgn;
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

  // getLastMove(): Move | null {
  //   return getLastChessMove(this.position);
  // }

  isInBranch(tree: VariationTree): boolean {
    if (this.equals(tree)) {
      return true;
    }
    if (this.parent === null) {
      return false;
    }
    return this.parent.isInBranch(tree);
  }

  addChild(pgn: string, score?: number, depth?: number): void {
    this.children.push(new VariationTree(this, pgn, [], score, depth));
  }
}

export function moveToKey(move: Move | null) {
  return move ? ([move.from, move.to] as Key[]) : undefined;
}

export function toDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map();
  Object.keys(SQUARES).forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true });
    ms.forEach((m) => {
      const to = m.to;
      if (dests.has(s)) {
        dests.get(s).push(to);
      } else {
        dests.set(s, [to]);
      }
      // allow to move the piece to rook square in case of castling
      if (m.piece === "k") {
        if (m.flags.includes("k")) {
          dests.get(s).push(m.color === "w" ? "h1" : "h8");
        }
        if (m.flags.includes("q")) {
          dests.get(s).push(m.color === "w" ? "a1" : "a8");
        }
      }
    });
  });
  return dests;
}

export function formatMove(orientation: string) {
  return orientation === "w" ? "white" : "black";
}

export function getLastChessMove(chess: Chess): Move | null {
  return chess.history({ verbose: true }).slice(-1)[0] || null;
}
