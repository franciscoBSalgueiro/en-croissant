import { warn } from 'tauri-plugin-log-api';
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
} from "./score";
import {
    createNode,
    defaultTree,
    GameHeaders,
    getColorFromFen,
    getNodeAtPath,
    headersToPGN,
    TreeNode,
    TreeState,
} from "./treeReducer";
import { MantineColor } from "@mantine/core";
import useSWR from 'swr';
import { Score } from '@/bindings';
import { match } from 'ts-pattern';

export const EMPTY_BOARD = "8/8/8/8/8/8/8/8";

function parseCsl(csl: string): DrawShape[] {
    const shapes = csl.split(",").map((square) => {
        if (square.length === 2) {
            return {
                orig: square as Square,
                brush: BRUSH_COLORS.get("DEFAULT"),
            } as DrawShape;
        } else if (square.length === 3) {
            return {
                orig: square.slice(1) as Square,
                brush: BRUSH_COLORS.get(square[0].toUpperCase()),
            } as DrawShape;
        } else {
            throw new Error("Invalid square: " + square);
        }
    });

    return shapes;
}

function parseCal(cal: string): DrawShape[] {
    const shapes = cal.split(",").map((square) => {
        if (square.length === 4) {
            return {
                orig: square.slice(0, 2) as Square,
                dest: square.slice(2) as Square,
                brush: BRUSH_COLORS.get("DEFAULT"),
            } as DrawShape;
        } else if (square.length === 5) {
            return {
                orig: square.slice(1, 3) as Square,
                dest: square.slice(3) as Square,
                brush: BRUSH_COLORS.get(square[0].toUpperCase()),
            } as DrawShape;
        } else {
            throw new Error("Invalid square: " + square);
        }
    });

    return shapes;
}

export type Annotation = "" | "!" | "!!" | "?" | "??" | "!?" | "?!";

const NAG_INFO = new Map<string, Annotation>([
    ["$1", "!"],
    ["$2", "?"],
    ["$3", "!!"],
    ["$4", "??"],
    ["$5", "!?"],
    ["$6", "?!"],
]);

type AnnotationInfo = {
    name: string;
    color: MantineColor;
};

export const BRUSH_COLORS = new Map<string, string>([
    ["DEFAULT", "green"],
    ["R", "red"],
    ["G", "green"],
    ["Y", "yellow"],
    ["B", "blue"]]);

export const ANNOTATION_INFO: Record<Annotation, AnnotationInfo> = {
    "": { name: "None", color: "gray" },
    "!!": { name: "Brilliant", color: "cyan" },
    "!": { name: "Good", color: "teal" },
    "!?": { name: "Interesting", color: "lime" },
    "?!": { name: "Dubious", color: "yellow" },
    "?": { name: "Mistake", color: "orange" },
    "??": { name: "Blunder", color: "red" },
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
    best: BestMoves[];
    novelty: boolean;
    maybe_brilliant: boolean;
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
    const isBlack = tree.halfMoves % 2 === 0;
    const moveNumber = Math.ceil(tree.halfMoves / 2);
    let moveText = "";

    if (tree.move) {
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
    }

    if (opt.comments || opt.specialSymbols) {
        let content = "{";

        if (opt.specialSymbols && tree.score !== null) {
            content += `[%eval ${formatScore(tree.score)}] `;
        }

        if (opt.specialSymbols && tree.shapes.length > 0) {
            const squares = tree.shapes
                .filter((shape) => shape.dest === undefined);
            const arrows = tree.shapes
                .filter((shape) => shape.dest !== undefined);

            if (squares.length > 0) {
                content += "[%csl " + squares.map(
                    (shape) => {return shape.brush[0].toUpperCase() + shape.orig}).join(",") + "]";
            }
            if (arrows.length > 0) {
                content += "[%cal " + arrows.map(
                    (shape) => {return shape.brush[0].toUpperCase() + shape.orig + shape.dest}).join(",") + "]";
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

export function getMainLine(root: TreeNode): string[] {
    const moves = [];
    let node = root;
    while (node.children.length > 0) {
        node = node.children[0];
        if (node.move) {
            moves.push(node.move.san);
        }
    }
    return moves;
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
        pgn += '[SetUp "1"]\n'
        pgn += '[FEN "' + tree.fen + '"]\n';
    }
    pgn += "\n";
    if (root && tree.commentText !== null) {
        pgn += `${getMoveText(tree, {symbols, comments, specialSymbols})}`
    }
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
    if (root) {
        pgn += " " + headers?.result ?? "*";
    }
    return pgn.trim();
}
export function moveToKey(move: Move | null) {
    return move ? ([move.from, move.to] as Key[]) : [];
}


const fileToNumber: Record<string, number> = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    f: 6,
    g: 7,
    h: 8,
};


export function moveToCoordinates(move: { from: string, to: string } | null, orientation: "white" | "black") {
    let file = fileToNumber[move?.to[0] ?? "a"];
    let rank = parseInt(move?.to[1] ?? "1");
    if (orientation === "black") {
        file = 9 - file;
        rank = 9 - rank;
    }
    return { file, rank }
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

export function parseKeyboardMove(san: string, fen: string) {
    function cleanSan(san: string) {
        if (san.length > 2) {
            const cleanedSan = san
                .replace(/^([kqbnr])/i, (_, match) => match.toUpperCase())
                .replace("o-o-o", "O-O-O")
                .replace("o-o", "O-O");
            return cleanedSan;
        }
        return san;
    }

    function makeMove(fen: string, san: string) {
        const chess = new Chess(fen);
        const move = chess.move(san);
        if (move) {
            return {
                from: move.from as Square,
                to: move.to as Square,
                promotion: move.promotion,
            };
        }
        return null;
    }
    try {
        return makeMove(fen, san);
    } catch (e) {
        try {
            return makeMove(fen, cleanSan(san));
        } catch (e) {
            warn(e as string);
            return null;
        }
    }
}

export async function getOpening(
    root: TreeNode,
    position: number[]
): Promise<string> {
    const tree = getNodeAtPath(root, position);
    if (tree === null) {
        return "";
    }
    return invoke<string>("get_opening_from_fen", { fen: tree.fen })
        .then((v) => v)
        .catch(() => position.length === 0 ? "" : getOpening(root, position.slice(0, -1)));
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

type Token =
    | { type: "ParenOpen" }
    | { type: "ParenClose" }
    | { type: "Comment"; value: string }
    | { type: "San"; value: string }
    | { type: "Header"; value: { tag: string; value: string } }
    | { type: "Nag"; value: string }
    | { type: "Outcome"; value: string };

function innerParsePGN(
    tokens: Token[],
    fen: string = DEFAULT_POSITION,
    halfMoves = 0
): TreeState {
    const tree = defaultTree(fen);
    let root = tree.root;
    let prevNode = root;
    root.halfMoves = halfMoves;
    if (halfMoves === 0 && getColorFromFen(fen) === "b") {
        root.halfMoves += 1;
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === "Comment") {
            let comment = token.value;

            const evl = comment.match(/\[%eval\s+([-+]?[0-9]*\.?[0-9]+)\]/);
            if (evl) {
                root.score = parseScore(evl[1]);
            }

            const csl = comment.match(/\[%csl\s+((?:[RGYB][a-h][1-8],?)+)\]/);
            if (csl) {
                root.shapes.push(...parseCsl(csl[1]));
            }

            const cal = comment.match(
                /\[%cal\s+((?:[RGYB][a-h][1-8][a-h][1-8],?)+)\]/
            );
            if (cal) {
                root.shapes.push(...parseCal(cal[1]));
            }

            // remove the special tags from the comment text
            comment = comment.replace(/\[%.*\]/g, "");

            if (comment.trim() !== "") {
                root.commentText = comment;
                root.commentHTML = `<p>${comment}</p>`;
            }
        } else if (token.type === "ParenOpen") {
            const variation = [];
            let subvariations = 0;
            i++;
            while (
                i < tokens.length &&
                (subvariations > 0 || tokens[i].type !== "ParenClose")
            ) {
                if (tokens[i].type === "ParenOpen") {
                    subvariations++;
                } else if (tokens[i].type === "ParenClose") {
                    subvariations--;
                }
                variation.push(tokens[i]);
                i++;
            }
            const newTree = innerParsePGN(
                variation,
                prevNode.fen,
                root.halfMoves - 1
            );
            if (newTree.root.children.length > 0) {
                prevNode.children.push(newTree.root.children[0]);
            }
        } else if (token.type === "ParenClose") {
            continue;
        } else if (token.type === "Nag") {
            root.annotation = NAG_INFO.get(token.value) || "";
        } else if (token.type === "San") {
            const chess = new Chess(root.fen);
            let m: Move;
            try {
                m = chess.move(token.value);
            } catch (error) {
                continue;
            }

            const newTree = createNode({
                fen: chess.fen(),
                move: m,
                halfMoves: root.halfMoves + 1,
            });
            root.children.push(newTree);

            prevNode = root;
            root = newTree;
        } else if (token.type === "Outcome") {
            break;
        }
    }
    return tree;
}

export async function parsePGN(pgn: string, halfMoves = 0): Promise<TreeState> {
    const tokens = await invoke<Token[]>("lex_pgn", { pgn: pgn });

    const headers = getPgnHeaders(tokens);
    const tree = innerParsePGN(tokens, headers.fen, halfMoves);
    tree.headers = headers;
    tree.position = headers.start ?? [];
    return tree;
}

function getPgnHeaders(tokens: Token[]): GameHeaders {
    const headersN = new Map<string, string>();

    for (const token of tokens) {
        if (token.type === "Header") {
            const { tag, value } = token.value;
            headersN.set(tag, value);
        } else if (token.type === "Outcome") {
            headersN.set("Result", token.value);
        }
    }

    const {
        Black,
        White,
        BlackElo,
        WhiteElo,
        Date,
        Site,
        Event,
        Result,
        FEN,
        Round,
        Start,
        Orientation,
    } = Object.fromEntries(headersN);

    const headers: GameHeaders = {
        id: 0,
        fen: FEN ?? DEFAULT_POSITION,
        result: (Result as Outcome) ?? "*",
        black: Black ?? "?",
        white: White ?? "?",
        round: Round ?? "?",
        black_elo: BlackElo ? parseInt(BlackElo) : 0,
        white_elo: WhiteElo ? parseInt(WhiteElo) : 0,
        date: Date ?? "",
        site: Site ?? "",
        event: Event ?? "",
        start: JSON.parse(Start ?? "[]"),
        orientation: (Orientation as "white" | "black") ?? "white",
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
    const whiteAnnotations = {
        "??": 0,
        "?": 0,
        "?!": 0,
        "!!": 0,
        "!": 0,
        "!?": 0,
    };

    const blackAnnotations = {
        "??": 0,
        "?": 0,
        "?!": 0,
        "!!": 0,
        "!": 0,
        "!?": 0,
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
    const cplosses: ColorMap<number[]> = {
        w: [],
        b: [],
    };
    const accuracies: ColorMap<number[]> = {
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

export type PiecesCount = {
    p: number;
    n: number;
    b: number;
    r: number;
    q: number;
};

export function useMaterialDiff(fen: string) {
    return useSWR(["material-diff", fen], async () => {
        const pieces = await invoke<PiecesCount>("get_pieces_count", { fen: fen });

        const diff =
            pieces.p * 1 +
            pieces.n * 3 +
            pieces.b * 3 +
            pieces.r * 5 +
            pieces.q * 9;

        return { pieces, diff };
    });
}
