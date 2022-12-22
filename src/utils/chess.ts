import { Chess, Move, Square, SQUARES } from "chess.js";
import { Key } from "chessground/types";

export type Score = {
    [key in "cp" | "mate"]: number;
}

export enum Annotation {
    None = "",
    Good = "!",
    Brilliant = "!!",
    Mistake = "?",
    Blunder = "??",
    Dubious = "?!",
    Interesting = "!?"
}

export function annotationColor(annotation: Annotation) {
    let color: string;
    switch (annotation) {
      case Annotation.Brilliant:
        color = "cyan";
        break;
      case "!":
        color = "teal";
        break;
      case "!?":
        color = "lime";
        break;
      case "?!":
        color = "yellow";
        break;
      case "?":
        color = "orange";
        break;
      case "??":
        color = "red";
        break;
      default:
        color = "gray";
    }
    return color;
}

export interface EngineVariation {
    engine: string;
    uciMoves: string[];
    sanMoves: string[];
    score: Score,
    depth: number;
    multipv: number;
    nps: number;
}

export class VariationTree {
    parent: VariationTree | null;
    fen: string;
    move: string | null;
    chess: Chess;
    lastMove: Move | null;
    children: VariationTree[];
    score: number;
    depth: number;
    half_moves: number;
    annotation: Annotation = Annotation.None;
    comment: string = "";

    constructor(
        parent: VariationTree | null,
        position: string,
        move: string | null,
        children?: VariationTree[],
        score?: number,
        depth?: number
    ) {
        this.parent = parent;
        this.fen = position;
        this.move = move;
        this.children = children ?? [];
        this.score = score ?? 0;
        this.depth = depth ?? 0;
        this.half_moves = parent ? parent.half_moves + 1 : 0;
        const chess = new Chess();
        chess.loadPgn(position);
        this.chess = chess;
        const history = chess.history({ verbose: true });
        if (history.length === 0) {
            this.lastMove = null;
        } else {
            this.lastMove = history[history.length - 1] as Move;
        }
    }

    equals(other: VariationTree): boolean {
        return this.fen === other.fen;
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

    addChild(move: string, score?: number, depth?: number): void {
        const chess = new Chess();
        const newMove = chess.move(move);
        this.children.push(new VariationTree(this, chess.fen(), newMove?.san ?? "", [], score, depth));
    }

    getNumberOfChildren(): number {
        let count = 0;
        for (const child of this.children) {
            count += 1 + child.getNumberOfChildren();
        }
        return count;
    }

    getNumberOfBranches(): number {
        let count = 0;
        for (let i = 0; i < this.children.length; i++) {
            if (i !== 0) {
                count += 1;
            }
            count += this.children[i].getNumberOfBranches();
        }
        return count;
    }
}

export function moveToKey(move: Move | null) {
    return move ? ([move.from, move.to] as Key[]) : undefined;
}

export function toDests(chess: Chess): Map<Key, Key[]> {
    const dests = new Map();
    SQUARES.forEach((s: Square) => {
        const ms = chess.moves({ square: s, verbose: true }) as Move[];
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
    const move = chess.undo();
    if (move) {
        chess.move(move);
    }
    return move;
}

export function parseUci(move: string) {
    const from = move.substring(0, 2) as Square;
    const to = move.substring(2, 4) as Square;
    return { from, to };
}
