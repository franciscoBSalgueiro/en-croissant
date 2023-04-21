import { invoke } from "@tauri-apps/api";
import {
    Chess,
    DEFAULT_POSITION,
    KING,
    Move,
    PieceSymbol,
    ROOK,
    Square,
    SQUARES,
} from "chess.js";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { CompleteGame, getHeaders, NormalizedGame, Outcome } from "./db";
import { formatScore } from "./format";

export type Score = {
    [key in "cp" | "mate"]: number;
};

function parseScore(score: string): Score {
    if (score.startsWith("#")) {
        return { mate: parseInt(score.slice(1)) } as Score;
    } else {
        return { cp: parseFloat(score) } as Score;
    }
}

function parseCsl(csl: string): DrawShape[] {
    let shapes = csl.split(",").map((square) => {
        if (square.length === 2) {
            return {
                orig: square as Square,
                brush: "green",
            } as DrawShape;
        } else if (square.length === 3) {
            return {
                orig: square.slice(1) as Square,
                brush: "green",
            } as DrawShape;
        } else {
            throw new Error("Invalid square: " + square);
        }
    });

    return shapes;
}

function parseCal(csl: string): DrawShape[] {
    let shapes = csl.split(",").map((square) => {
        if (square.length === 4) {
            return {
                orig: square.slice(0, 2) as Square,
                dest: square.slice(2) as Square,
                brush: "green",
            } as DrawShape;
        } else if (square.length === 5) {
            return {
                orig: square.slice(1, 3) as Square,
                dest: square.slice(3) as Square,
                brush: "green",
            } as DrawShape;
        } else {
            throw new Error("Invalid square: " + square);
        }
    });

    return shapes;
}

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

export interface BestMoves {
    depth: number;
    score: Score;
    uciMoves: string[];
    sanMoves: string[];
    multipv: number;
    nps: number;
}

export interface BestMovesPayload {
    bestLines: BestMoves[];
    engine: string;
    tab: string;
}

export class VariationTree {
    parent: VariationTree | null;
    fen: string;
    move: Move | null;
    children: VariationTree[];
    score: Score | null;
    depth: number;
    halfMoves: number;
    shapes: DrawShape[] = [];
    annotation: Annotation = Annotation.None;
    commentHTML: string = "";
    commentText: string = "";

    constructor(
        parent: VariationTree | null,
        fen: string,
        move: Move | null,
        children?: VariationTree[],
        score?: Score,
        depth?: number
    ) {
        this.parent = parent;
        this.fen = fen;
        this.move = move;
        this.children = children ?? [];
        this.score = score ?? null;
        this.depth = depth ?? 0;
        this.halfMoves = parent ? parent.halfMoves + 1 : 0;
    }

    equals(other: VariationTree): boolean {
        return this.fen === other.fen;
    }

    getPosition(): number[] {
        let currentTree: VariationTree = this;
        let positions: number[] = [];
        while (currentTree.parent !== null) {
            const parent = currentTree.parent;
            const index = parent.children.indexOf(currentTree);
            positions.unshift(index);
            currentTree = parent;
        }
        return positions;
    }

    getMoveText(
        symbols: boolean,
        comments: boolean,
        specialSymbols: boolean,
        isFirst?: boolean
    ): string {
        if (this.move === null) {
            return "";
        }
        const isBlack = this.halfMoves % 2 === 0;
        const moveNumber = Math.ceil(this.halfMoves / 2);
        let moveText = "";
        if (isBlack) {
            if (isFirst) {
                moveText += `${moveNumber}... `;
            }
        } else {
            moveText += `${moveNumber}. `;
        }
        moveText += this.move.san;
        if (symbols) {
            moveText += this.annotation;
        }
        moveText += " ";

        if (comments || specialSymbols) {
            let content = "{";

            if (specialSymbols && this.score !== null) {
                content += `[%eval ${formatScore(this.score).text}] `;
            }

            if (specialSymbols && this.shapes.length > 0) {
                const squares = this.shapes
                    .filter((shape) => shape.dest === undefined)
                    .map((shape) => {
                        return shape.orig;
                    });
                const arrows = this.shapes
                    .filter((shape) => shape.dest !== undefined)
                    .map((shape) => {
                        return shape.orig + shape.dest;
                    });
                if (squares.length > 0) {
                    content += `[%csl ${squares.join(",")}] `;
                }
                if (arrows.length > 0) {
                    content += `[%cal ${arrows.join(",")}] `;
                }
            }

            if (comments && this.commentText !== "") {
                content += this.commentText;
            }
            content += "} ";

            if (content !== "{} ") {
                moveText += content;
            }
        }
        return moveText;
    }

    getPGN({
        headers,
        symbols = true,
        comments = true,
        variations = true,
        specialSymbols = true,
    }: {
        headers: NormalizedGame | null;
        symbols?: boolean;
        comments?: boolean;
        variations?: boolean;
        specialSymbols?: boolean;
    }): string {
        let pgn = "";
        if (headers) {
            pgn += getHeaders(headers);
        }
        if (this.parent === null) {
            if (this.fen !== DEFAULT_POSITION) {
                pgn += '[FEN "' + this.fen + '"]\n\n';
            } else {
                pgn += "\n";
            }
        }
        const variationsPGN = variations
            ? this.children.slice(1).map(
                  (variation) =>
                      `${variation.getMoveText(
                          symbols,
                          comments,
                          true
                      )} ${variation.getPGN({
                          headers: null,
                          symbols,
                          comments,
                          variations,
                          specialSymbols,
                      })}`
              )
            : [];
        if (this.children.length > 0) {
            const child = this.children[0];
            pgn += child.getMoveText(symbols, comments, specialSymbols);
        }
        if (variationsPGN.length >= 1) {
            variationsPGN.forEach((variation) => {
                pgn += ` (${variation}) `;
            });
        }

        if (this.children.length > 0) {
            pgn += this.children[0].getPGN({
                headers: null,
                symbols,
                comments,
                variations,
                specialSymbols,
            });
        }
        return pgn.trim();
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

export function goToPosition(
    tree: VariationTree,
    position: number[]
): VariationTree {
    let currentTree = tree;
    for (const index of position) {
        currentTree = currentTree.children[index];
    }
    return currentTree;
}

export function moveToKey(move: Move | null) {
    return move ? ([move.from, move.to] as Key[]) : [];
}

export function toDests(
    chess: Chess | null,
    forcedEP: boolean
): Map<Key, Key[]> {
    const dests = new Map();
    if (chess === null) {
        return dests;
    }
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
    const promotion = move.length === 5 ? move[4] : undefined;
    return { from, to, promotion };
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

export function parsePGN(
    pgn: string,
    fen: string = DEFAULT_POSITION,
    halfMoves: number = 0
): VariationTree {
    let tree = new VariationTree(null, fen, null);
    tree.halfMoves = halfMoves;
    pgn = pgn.replaceAll("[", " [ ");
    pgn = pgn.replaceAll("]", " ] ");
    pgn = pgn.replaceAll("(", " ( ");
    pgn = pgn.replaceAll(")", " ) ");
    pgn = pgn.replaceAll("{", " { ");
    pgn = pgn.replaceAll("}", " } ");
    pgn = pgn.replaceAll(/\s+/g, " ");
    pgn = pgn.replaceAll(/\d+\./g, "");
    pgn = pgn.trim();
    const tokens = pgn.split(" ");

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === "[" && halfMoves === 0) {
            let tag = "";
            let value = "";
            i++;
            tag += tokens[i];
            i++;
            while (tokens[i] !== "]") {
                value += tokens[i] + " ";
                i++;
            }
            if (tag === "FEN") {
                tree.fen = value.substring(1, value.length - 1);
            }
        } else if (token === "") {
            continue;
        } else if (token === "{") {
            let comment = "";
            i++;
            while (tokens[i] !== "}") {
                if (tokens[i] === "[") {
                    i++;
                    const tag = tokens[i];
                    i++;
                    let value = "";
                    while (tokens[i] !== "]") {
                        value += tokens[i];
                        i++;
                    }
                    if (tag === "%eval") {
                        tree.score = parseScore(value);
                    }
                    if (tag === "%csl") {
                        tree.shapes.push(...parseCsl(value));
                    }
                    if (tag === "%cal") {
                        tree.shapes.push(...parseCal(value));
                    }
                    i++;
                    continue;
                }
                comment += tokens[i] + " ";
                i++;
            }
            tree.commentText = comment;
            tree.commentHTML = `<p>${comment}</p>`;
        } else if (token === "(") {
            let variation = "";
            let subvariations = 0;
            i++;
            while (subvariations > 0 || tokens[i] !== ")") {
                if (tokens[i] === "(") {
                    subvariations++;
                } else if (tokens[i] === ")") {
                    subvariations--;
                }
                variation += tokens[i] + " ";

                i++;
            }
            tree = tree.parent!;
            const variationTree = parsePGN(variation, tree.fen, tree.halfMoves)
                .children[0];
            variationTree.parent = tree;
            tree.children.push(variationTree);
            tree = tree.children[0];
        } else if (token === ")") {
            continue;
        } else if (
            token === "1-0" ||
            token === "0-1" ||
            token === "1/2-1/2" ||
            token === "*"
        ) {
            break;
        } else {
            const chess = new Chess(tree.fen);
            let m: Move;
            try {
                m = chess.move(token);
            } catch (error) {
                console.log(error);
                continue;
            }

            const newTree = new VariationTree(tree, chess.fen(), m);
            tree.children.push(newTree);

            if (token.endsWith("!!" || "$3")) {
                newTree.annotation = Annotation.Brilliant;
            } else if (token.endsWith("!?" || "$5")) {
                newTree.annotation = Annotation.Interesting;
            } else if (token.endsWith("?!" || "$6")) {
                newTree.annotation = Annotation.Dubious;
            } else if (token.endsWith("??" || "$4")) {
                newTree.annotation = Annotation.Blunder;
            } else if (token.endsWith("!" || "$1")) {
                newTree.annotation = Annotation.Good;
            } else if (token.endsWith("?" || "$2")) {
                newTree.annotation = Annotation.Mistake;
            }
            tree = newTree;
        }
    }
    return tree.getTopVariation();
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

export function stripPGNheader(pgn: string) {
    const lines = pgn.split("\n");
    let i = 0;

    while (
        i < lines.length &&
        (lines[i].startsWith("[") || lines[i].trim() === "")
    ) {
        i++;
    }
    return lines.slice(i).join("\n");
}

export function getCompleteGame(pgn: string): CompleteGame {
    pgn = pgn.replaceAll("0-0", "O-O");

    const chess = new Chess();
    chess.loadPgn(pgn);
    const { Result, Site, Date, White, Black, BlackElo, WhiteElo, Event, FEN } =
        chess.header();

    const game: CompleteGame = {
        currentMove: [],
        game: {
            id: 0,
            result: (Result as Outcome) ?? Outcome.Unknown,
            black: {
                id: 0,
                name: Black ?? "?",
            },
            white: {
                id: 0,
                name: White ?? "?",
            },
            black_elo: BlackElo ? parseInt(BlackElo) : 0,
            white_elo: WhiteElo ? parseInt(WhiteElo) : 0,
            date: Date ?? "",
            moves: stripPGNheader(pgn),
            ply_count: chess.history().length,
            site: {
                id: 0,
                name: Site ?? "",
            },
            event: {
                id: 0,
                name: Event ?? "",
            },
            tree: new VariationTree(null, FEN || DEFAULT_POSITION, null),
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

export function uciToMove(uci: string, fen: string): Move | null {
    try {
        const chess = new Chess(fen);
        const orig = uci.slice(0, 2) as Key;
        const dest = handleMove(chess, orig, uci.slice(2, 4) as Key);
        let promotion: PieceSymbol | undefined;
        if (uci.length === 5) {
            promotion = uci[4] as PieceSymbol;
        }

        return chess.move({
            from: orig,
            to: dest!,
            promotion,
        });
    } catch (e) {
        return null;
    }
}
