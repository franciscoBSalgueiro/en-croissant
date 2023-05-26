import { invoke } from "@tauri-apps/api";
import {
    Chess,
    Color,
    DEFAULT_POSITION,
    KING,
    Move,
    ROOK,
    Square,
    SQUARES,
} from "chess.js";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { Outcome } from "./db";
import { harmonicMean, mean } from "./misc";
import {
    formatScore,
    getAccuracy,
    getCPLoss,
    INITIAL_SCORE,
    parseScore,
    Score,
} from "./score";
import {
    createNode,
    defaultTree,
    GameHeaders,
    getNodeAtPath,
    headersToPGN,
    TreeNode,
    TreeState,
} from "./treeReducer";

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

export const enum Annotation {
    None = "",
    Good = "!",
    Brilliant = "!!",
    Mistake = "?",
    Blunder = "??",
    Dubious = "?!",
    Interesting = "!?",
}

type AnnotationInfo = {
    name: string;
    color: string;
};

export const ANNOTATION_INFO: Record<Annotation, AnnotationInfo> = {
    [Annotation.None]: { name: "None", color: "gray" },
    [Annotation.Brilliant]: { name: "Brilliant", color: "cyan" },
    [Annotation.Good]: { name: "Good", color: "teal" },
    [Annotation.Interesting]: { name: "Interesting", color: "lime" },
    [Annotation.Dubious]: { name: "Dubious", color: "yellow" },
    [Annotation.Mistake]: { name: "Mistake", color: "orange" },
    [Annotation.Blunder]: { name: "Blunder", color: "red" },
};

export interface BestMoves {
    depth: number;
    score: Score;
    uciMoves: string[];
    sanMoves: string[];
    multipv: number;
    nps: number;
}

export interface MoveAnalysis {
    best: BestMoves;
    novelty: boolean;
}

export interface BestMovesPayload {
    bestLines: BestMoves[];
    engine: string;
    tab: string;
}

export function getMoveText(
    tree: TreeNode,
    opt: {
        symbols: boolean;
        comments: boolean;
        specialSymbols: boolean;
        isFirst?: boolean;
    }
): string {
    if (tree.move === null) {
        return "";
    }
    const isBlack = tree.halfMoves % 2 === 0;
    const moveNumber = Math.ceil(tree.halfMoves / 2);
    let moveText = "";
    if (isBlack) {
        if (opt.isFirst) {
            moveText += `${moveNumber}... `;
        }
    } else {
        moveText += `${moveNumber}. `;
    }
    moveText += tree.move.san;
    if (opt.symbols) {
        moveText += tree.annotation;
    }
    moveText += " ";

    if (opt.comments || opt.specialSymbols) {
        let content = "{";

        if (opt.specialSymbols && tree.score !== null) {
            content += `[%eval ${formatScore(tree.score)}] `;
        }

        if (opt.specialSymbols && tree.shapes.length > 0) {
            const squares = tree.shapes
                .filter((shape) => shape.dest === undefined)
                .map((shape) => {
                    return shape.orig;
                });
            const arrows = tree.shapes
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

        if (opt.comments && tree.commentText !== "") {
            content += tree.commentText;
        }
        content += "} ";

        if (content !== "{} ") {
            moveText += content;
        }
    }
    return moveText;
}

export function getPGN(
    tree: TreeNode,
    {
        headers,
        symbols = true,
        comments = true,
        variations = true,
        specialSymbols = true,
        root = true,
    }: {
        headers: GameHeaders | null;
        symbols?: boolean;
        comments?: boolean;
        variations?: boolean;
        specialSymbols?: boolean;
        root?: boolean;
    }
): string {
    let pgn = "";
    if (headers) {
        pgn += headersToPGN(headers);
    }
    if (root && tree.fen !== DEFAULT_POSITION) {
        pgn += '[FEN "' + tree.fen + '"]\n';
    }
    pgn += "\n";
    const variationsPGN = variations
        ? tree.children.slice(1).map(
            (variation) =>
                `${getMoveText(variation, {
                    symbols,
                    comments,
                    specialSymbols,
                    isFirst: true,
                })} ${getPGN(variation, {
                    headers: null,
                    symbols,
                    comments,
                    variations,
                    specialSymbols,
                    root: false,
                })}`
        )
        : [];
    if (tree.children.length > 0) {
        const child = tree.children[0];
        pgn += getMoveText(child, { symbols, comments, specialSymbols });
    }
    if (variationsPGN.length >= 1) {
        variationsPGN.forEach((variation) => {
            pgn += ` (${variation}) `;
        });
    }

    if (tree.children.length > 0) {
        pgn += getPGN(tree.children[0], {
            headers: null,
            symbols,
            comments,
            variations,
            specialSymbols,
            root: false,
        });
    }
    return pgn.trim();
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

export function parseUci(move: string) {
    const from = move.substring(0, 2) as Square;
    const to = move.substring(2, 4) as Square;
    const promotion = move.length === 5 ? move[4] : undefined;
    return { from, to, promotion };
}

export async function getOpening(
    root: TreeNode,
    position: number[]
): Promise<string> {
    if (position.length === 0) {
        return "";
    }
    const tree = getNodeAtPath(root, position);
    if (tree === null) {
        return "";
    }
    return invoke<string>("get_opening_from_fen", { fen: tree.fen })
        .then((v) => v)
        .catch(() => getOpening(root, position.slice(0, -1)));
}

export function swapMove(fen: string, color?: Color) {
    const fenGroups = fen.split(" ");
    if (color) {
        fenGroups[1] = color;
    } else {
        fenGroups[1] = fenGroups[1] === "w" ? "b" : "w";
    }
    fenGroups[3] = "-";

    return fenGroups.join(" ");
}

export function parsePGN(
    pgn: string,
    fen: string = DEFAULT_POSITION,
    halfMoves: number = 0
): TreeState {
    let tree = defaultTree(fen);
    let root = tree.root;
    let prevNode = root;
    root.halfMoves = halfMoves;
    pgn = pgn.replaceAll("[", " [ ");
    pgn = pgn.replaceAll("]", " ] ");
    pgn = pgn.replaceAll("(", " ( ");
    pgn = pgn.replaceAll(")", " ) ");
    pgn = pgn.replaceAll("{", " { ");
    pgn = pgn.replaceAll("}", " } ");
    pgn = pgn.replaceAll(/\s+/g, " ");
    // pgn = pgn.replaceAll(/\d+\./g, "");
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
                root.fen = value.substring(1, value.length - 1);
            }
        } else if (token === "" || token.match(/\d+\./)) {
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
                        root.score = parseScore(value);
                    }
                    if (tag === "%csl") {
                        root.shapes.push(...parseCsl(value));
                    }
                    if (tag === "%cal") {
                        root.shapes.push(...parseCal(value));
                    }
                    i++;
                    continue;
                }
                comment += tokens[i] + " ";
                i++;
            }
            if (comment.trim() !== "") {
                root.commentText = comment;
                root.commentHTML = `<p>${comment}</p>`;
            }
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
            const newTree = parsePGN(variation, prevNode.fen, root.halfMoves - 1);
            prevNode.children.push(newTree.root.children[0]);
        } else if (token === ")") {
            continue;
        } else if (
            token === "$1" ||
            token === "$2" ||
            token === "$3" ||
            token === "$4" ||
            token === "$5" ||
            token === "$6"
        ) {
            if (token.endsWith("!!") || token.endsWith("$3")) {
                root.annotation = Annotation.Brilliant;
            } else if (token.endsWith("!?") || token.endsWith("$5")) {
                root.annotation = Annotation.Interesting;
            } else if (token.endsWith("?!") || token.endsWith("$6")) {
                root.annotation = Annotation.Dubious;
            } else if (token.endsWith("??") || token.endsWith("$4")) {
                root.annotation = Annotation.Blunder;
            } else if (token.endsWith("!") || token.endsWith("$1")) {
                root.annotation = Annotation.Good;
            } else if (token.endsWith("?") || token.endsWith("$2")) {
                root.annotation = Annotation.Mistake;
            }
        } else if (
            token === "1-0" ||
            token === "0-1" ||
            token === "1/2-1/2" ||
            token === "*"
        ) {
            break;
        } else {
            const chess = new Chess(root.fen);
            let m: Move;
            try {
                m = chess.move(token);
            } catch (error) {
                console.log(error);
                continue;
            }

            const newTree = createNode({
                fen: chess.fen(),
                move: m,
                halfMoves: root.halfMoves + 1,
            });
            root.children.push(newTree);

            if (token.endsWith("!!") || token.endsWith("$3")) {
                newTree.annotation = Annotation.Brilliant;
            } else if (token.endsWith("!?") || token.endsWith("$5")) {
                newTree.annotation = Annotation.Interesting;
            } else if (token.endsWith("?!") || token.endsWith("$6")) {
                newTree.annotation = Annotation.Dubious;
            } else if (token.endsWith("??") || token.endsWith("$4")) {
                newTree.annotation = Annotation.Blunder;
            } else if (token.endsWith("!") || token.endsWith("$1")) {
                newTree.annotation = Annotation.Good;
            } else if (token.endsWith("?") || token.endsWith("$2")) {
                newTree.annotation = Annotation.Mistake;
            }
            prevNode = root;
            root = newTree;
        }
    }
    return tree;
}

export function getPgnHeaders(pgn: string): GameHeaders {
    pgn = pgn.replaceAll("0-0", "O-O");

    const chess = new Chess();
    chess.loadPgn(pgn);
    const { Result, Site, Date, White, Black, BlackElo, WhiteElo, Event, FEN } =
        chess.header();

    const headers: GameHeaders = {
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
        ply_count: chess.history().length,
        site: {
            id: 0,
            name: Site ?? "",
        },
        event: {
            id: 0,
            name: Event ?? "",
        },
    };
    return headers;
}

export function handleMove(chess: Chess, orig: Key, dest: Key): Square {
    if (orig === "a0" || dest === "a0") {
        // NOTE: Idk if this can happen
        throw new Error("Invalid move");
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

type ColorMap<T> = {
    [key in Color]: T;
};

/* traverse the main line and get the average centipawn loss for each player*/
export function getGameStats(tree: TreeNode) {
    let whiteAnnotations = {
        [Annotation.Blunder]: 0,
        [Annotation.Mistake]: 0,
        [Annotation.Dubious]: 0,
        [Annotation.Brilliant]: 0,
        [Annotation.Good]: 0,
        [Annotation.Interesting]: 0,
    };

    let blackAnnotations = {
        [Annotation.Blunder]: 0,
        [Annotation.Mistake]: 0,
        [Annotation.Dubious]: 0,
        [Annotation.Brilliant]: 0,
        [Annotation.Good]: 0,
        [Annotation.Interesting]: 0,
    };

    if (tree.children.length === 0) {
        return {
            whiteCPL: 0,
            blackCPL: 0,
            whiteAccuracy: 0,
            blackAccuracy: 0,
            whiteAnnotations,
            blackAnnotations,
        };
    }

    let prevScore: Score = tree.score ?? INITIAL_SCORE;
    let cplosses: ColorMap<number[]> = {
        w: [],
        b: [],
    };
    let accuracies: ColorMap<number[]> = {
        w: [],
        b: [],
    };
    while (tree.children.length > 0) {
        tree = tree.children[0];
        if (tree.annotation) {
            if (tree.halfMoves % 2 === 1) {
                whiteAnnotations[tree.annotation]++;
            } else {
                blackAnnotations[tree.annotation]++;
            }
        }
        const color = tree.halfMoves % 2 == 1 ? "w" : "b";
        if (tree.score) {
            cplosses[color].push(getCPLoss(prevScore, tree.score, color));
            accuracies[color].push(getAccuracy(prevScore, tree.score, color));
            prevScore = tree.score;
        }
    }
    const whiteCPL = mean(cplosses.w);
    const blackCPL = mean(cplosses.b);
    const whiteAccuracy = harmonicMean(accuracies.w);
    const blackAccuracy = harmonicMean(accuracies.b);

    return {
        whiteCPL,
        blackCPL,
        whiteAccuracy,
        blackAccuracy,
        whiteAnnotations,
        blackAnnotations,
    };
}
