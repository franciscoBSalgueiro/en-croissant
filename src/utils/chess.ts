import { invoke } from "@tauri-apps/api";
import {
    Chess,
    DEFAULT_POSITION,
    KING,
    Move,
    ROOK,
    Square,
    SQUARES,
} from "chess.js";
import { Key } from "chessground/types";
import { CompleteGame, Outcome, Speed } from "./db";

export type Score = {
    [key in "cp" | "mate"]: number;
};

export enum Annotation {
    None = "",
    Good = "!",
    Brilliant = "!!",
    Mistake = "?",
    Blunder = "??",
    Dubious = "?!",
    Interesting = "!?",
}

export function annotationColor(annotation: Annotation) {
    let color: string;
    switch (annotation) {
        case Annotation.Brilliant:
            color = "cyan";
            break;
        case Annotation.Good:
            color = "teal";
            break;
        case Annotation.Interesting:
            color = "lime";
            break;
        case Annotation.Dubious:
            color = "yellow";
            break;
        case Annotation.Mistake:
            color = "orange";
            break;
        case Annotation.Blunder:
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
    score: Score;
    depth: number;
    multipv: number;
    nps: number;
}

export class VariationTree {
    parent: VariationTree | null;
    fen: string;
    move: Move | null;
    children: VariationTree[];
    score: number;
    depth: number;
    half_moves: number;
    annotation: Annotation = Annotation.None;
    commentHTML: string = "";
    commentText: string = "";

    constructor(
        parent: VariationTree | null,
        fen: string,
        move: Move | null,
        children?: VariationTree[],
        score?: number,
        depth?: number
    ) {
        this.parent = parent;
        this.fen = fen;
        this.move = move;
        this.children = children ?? [];
        this.score = score ?? 0;
        this.depth = depth ?? 0;
        this.half_moves = parent ? parent.half_moves + 1 : 0;
    }

    equals(other: VariationTree): boolean {
        return this.fen === other.fen;
    }

    getMoveText(isFirst?: boolean): string {
        if (this.move === null) {
            return "";
        }
        const isBlack = this.half_moves % 2 === 0;
        const moveNumber = Math.ceil(this.half_moves / 2);
        let moveText = "";
        if (isBlack) {
            if (isFirst) {
                moveText += `${moveNumber}... `;
            }
        } else {
            moveText += `${moveNumber}. `;
        }
        moveText += this.move.san + this.annotation + " ";
        if (this.commentText !== "") {
            moveText += `{${this.commentText}} `;
        }
        return moveText;
    }

    getPGN(): string {
        let pgn = "";
        const variationsPGN = this.children
            .slice(1)
            .map(
                (variation) =>
                    `${variation.getMoveText(true)} ${variation.getPGN()}`
            );
        if (this.children.length > 0) {
            console.log(this.children[0].move?.san);
        }
        if (this.children.length > 0) {
            const child = this.children[0];
            pgn += child.getMoveText();
        }
        if (variationsPGN.length >= 1) {
            variationsPGN.forEach((variation) => {
                pgn += ` (${variation}) `;
            });
        }

        if (this.children.length > 0) {
            pgn += this.children[0].getPGN();
        }
        return pgn;
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

    isInBranch(tree: VariationTree): boolean {
        if (this.equals(tree)) {
            return true;
        }
        if (this.parent === null) {
            return false;
        }
        return this.parent.isInBranch(tree);
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
    return move ? ([move.from, move.to] as Key[]) : [];
}

export function toDests(chess: Chess, forcedEP: boolean): Map<Key, Key[]> {
    const dests = new Map();
    for (const s of SQUARES) {
        const ms = chess.moves({ square: s, verbose: true }) as Move[];
        for (const m of ms) {
            const to = m.to;
            if (dests.has(s)) {
                dests.get(s).push(to);
            } else {
                dests.set(s, [to]);
            }
            // Forced en-passant
            if (forcedEP && m.flags === "e") {
                dests.clear();
                dests.set(s, [to]);
                return dests;
            }
            // allow to move the piece to rook square in case of castling
            if (m.piece === "k") {
                if (m.flags === "k") {
                    dests.get(s).push(m.color === "w" ? "h1" : "h8");
                }
                if (m.flags === "q") {
                    dests.get(s).push(m.color === "w" ? "a1" : "a8");
                }
            }
        }
    }
    return dests;
}

export function formatMove(orientation: string) {
    return orientation === "w" ? "white" : "black";
}

export function parseUci(move: string) {
    const from = move.substring(0, 2) as Square;
    const to = move.substring(2, 4) as Square;
    return { from, to };
}

export async function getOpening(tree: VariationTree | null): Promise<string> {
    if (tree === null) {
        return "";
    }
    return invoke("get_opening", { fen: tree.fen })
        .then((v) => v as string)
        .catch(() => getOpening(tree.parent));
}

export function swapMove(fen: string) {
    const fenGroups = fen.split(" ");
    fenGroups[1] = fenGroups[1] === "w" ? "b" : "w";
    fenGroups[3] = "-";

    return fenGroups.join(" ");
}

export function chessToVariatonTree(chess: Chess, currentMove?: number) {
    let tree = new VariationTree(null, DEFAULT_POSITION, null);
    let currentTree = tree;
    const newChess = new Chess(DEFAULT_POSITION);
    chess.history().forEach((move) => {
        const m = newChess.move(move);
        const newTree = new VariationTree(currentTree, newChess.fen(), m);
        currentTree.children.push(newTree);
        currentTree = newTree;
    });
    if (currentMove !== undefined) {
        let root = tree.getTopVariation();
        for (let i = 0; i < currentMove; i++) {
            if (root.children.length === 0) {
                break;
            }
            root = root.children[0];
        }
        return root;
    }
    return tree;
}

export function movesToVariationTree(
    moves: string,
    fen: string = DEFAULT_POSITION
) {
    let movesList = moves.split(" ");
    let tree = new VariationTree(null, fen, null);
    if (moves === "") {
        return tree;
    }
    let currentTree = tree;
    for (let i = 0; i < movesList.length; i++) {
        const move = movesList[i];
        const chess = new Chess(currentTree.fen);
        const m = chess.move(move);
        const newTree = new VariationTree(currentTree, chess.fen(), m);
        currentTree.children.push(newTree);
        currentTree = newTree;
    }
    return tree;
}

export function getCompleteGame(pgn: string): CompleteGame {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const { Result, Site, Date, White, Black, BlackElo, WhiteElo } =
        chess.header();

    // const outcome = chess.header("Result");
    const game: CompleteGame = {
        black: {
            game_count: 0,
            id: 0,
            name: Black ?? "?",
        },
        white: {
            game_count: 0,
            id: 0,
            name: White ?? "?",
        },
        currentMove: 0,
        game: {
            black: 0,
            white: 0,
            speed: Speed.Unknown,
            outcome: (Result as Outcome) ?? Outcome.Unknown,
            black_rating: BlackElo ? parseInt(BlackElo) : 0,
            white_rating: WhiteElo ? parseInt(WhiteElo) : 0,
            date: Date ?? "",
            moves: chess.pgn(),
            site: Site ?? "",
        },
    };
    return game;
}

export function handleMove(chess: Chess, orig: Key, dest: Key): Square | null {
    if (orig === "a0" || dest === "a0") {
        // NOTE: Idk if this can happen
        return null;
    }
    // allow castling to the rooks
    if (chess.get(orig).type === KING && chess.get(dest).type === ROOK) {
        switch (dest) {
            case "h1":
                dest = "g1";
                break;
            case "a1":
                dest = "c1";
                break;
            case "h8":
                dest = "g8";
                break;
            case "a8":
                dest = "c8";
                break;
        }
    }
    return dest;
}
