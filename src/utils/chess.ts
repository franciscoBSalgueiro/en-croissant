import { Score, commands } from "@/bindings";
import { MantineColor } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { Chess, Move, Square } from "chess.js";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { Color, Role, makeSquare, makeUci, parseSquare } from "chessops";
import { INITIAL_FEN, parseFen, parsePiece } from "chessops/fen";
import { isPawns, parseComment } from "chessops/pgn";
import { warn } from "tauri-plugin-log-api";
import { Outcome } from "./db";
import { harmonicMean, mean } from "./misc";
import { INITIAL_SCORE, formatScore, getAccuracy, getCPLoss } from "./score";
import {
  GameHeaders,
  TreeNode,
  TreeState,
  createNode,
  defaultTree,
  getNodeAtPath,
  headersToPGN,
} from "./treeReducer";

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
  is_sacrifice: boolean;
}

// copied from chessops
export const makeClk = (seconds: number): string => {
  seconds = Math.max(0, seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  seconds = (seconds % 3600) % 60;
  return `${hours}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toLocaleString("en", {
    minimumIntegerDigits: 2,
    maximumFractionDigits: 3,
  })}`;
};

export function getMoveText(
  tree: TreeNode,
  opt: {
    glyphs: boolean;
    comments: boolean;
    extraMarkups: boolean;
    isFirst?: boolean;
  },
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
    if (opt.glyphs) {
      moveText += tree.annotation;
    }
    moveText += " ";
  }

  if (opt.comments || opt.extraMarkups) {
    let content = "{";

    if (opt.extraMarkups) {
      if (tree.score !== null) {
        content += `[%eval ${formatScore(tree.score)}] `;
      }
      if (tree.clock !== undefined) {
        content += `[%clk ${makeClk(tree.clock)}] `;
      }
    }

    if (opt.extraMarkups && tree.shapes.length > 0) {
      const squares = tree.shapes.filter((shape) => shape.dest === undefined);
      const arrows = tree.shapes.filter((shape) => shape.dest !== undefined);

      if (squares.length > 0) {
        content +=
          "[%csl " +
          squares
            .map((shape) => {
              return shape.brush[0].toUpperCase() + shape.orig;
            })
            .join(",") +
          "]";
      }
      if (arrows.length > 0) {
        content +=
          "[%cal " +
          arrows
            .map((shape) => {
              return shape.brush[0].toUpperCase() + shape.orig + shape.dest;
            })
            .join(",") +
          "]";
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
      moves.push(
        makeUci({
          from: parseSquare(node.move.from),
          to: parseSquare(node.move.to),
          promotion: node.move.promotion
            ? parsePiece(node.move.promotion)?.role
            : undefined,
        }),
      );
    }
  }
  return moves;
}

export function getVariationLine(root: TreeNode, position: number[]): string[] {
  const moves = [];
  let node = root;
  for (const pos of position) {
    node = node.children[pos];
    if (node.move) {
      moves.push(
        makeUci({
          from: parseSquare(node.move.from),
          to: parseSquare(node.move.to),
          promotion: node.move.promotion
            ? parsePiece(node.move.promotion)?.role
            : undefined,
        }),
      );
    }
  }
  return moves;
}

export function getPGN(
  tree: TreeNode,
  {
    headers,
    glyphs = true,
    comments = true,
    variations = true,
    extraMarkups = true,
    root = true,
  }: {
    headers: GameHeaders | null;
    glyphs?: boolean;
    comments?: boolean;
    variations?: boolean;
    extraMarkups?: boolean;
    root?: boolean;
  },
): string {
  let pgn = "";
  if (headers) {
    pgn += headersToPGN(headers);
  }
  if (root && tree.fen !== INITIAL_FEN) {
    pgn += '[SetUp "1"]\n';
    pgn += '[FEN "' + tree.fen + '"]\n';
  }
  pgn += "\n";
  if (root && tree.commentText !== null) {
    pgn += `${getMoveText(tree, { glyphs, comments, extraMarkups })}`;
  }
  const variationsPGN = variations
    ? tree.children.slice(1).map(
        (variation) =>
          `${getMoveText(variation, {
            glyphs,
            comments,
            extraMarkups,
            isFirst: true,
          })} ${getPGN(variation, {
            headers: null,
            glyphs,
            comments,
            variations,
            extraMarkups,
            root: false,
          })}`,
      )
    : [];
  if (tree.children.length > 0) {
    const child = tree.children[0];
    pgn += getMoveText(child, {
      glyphs: glyphs,
      comments,
      extraMarkups,
      isFirst: root,
    });
  }
  if (variationsPGN.length >= 1) {
    variationsPGN.forEach((variation) => {
      pgn += ` (${variation}) `;
    });
  }

  if (tree.children.length > 0) {
    pgn += getPGN(tree.children[0], {
      headers: null,
      glyphs,
      comments,
      variations,
      extraMarkups,
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
  position: number[],
): Promise<string> {
  const tree = getNodeAtPath(root, position);
  if (tree === null) {
    return "";
  }
  const res = await commands.getOpeningFromFen(tree.fen);
  if (res.status === "error") {
    if (position.length === 0) {
      return "";
    }
    return getOpening(root, position.slice(0, -1));
  } else {
    return res.data;
  }
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
  fen: string = INITIAL_FEN,
  halfMoves = 0,
): TreeState {
  const tree = defaultTree(fen);
  let root = tree.root;
  let prevNode = root;
  root.halfMoves = halfMoves;
  const setup = parseFen(fen).unwrap();

  if (halfMoves === 0 && setup.turn === "black") {
    root.halfMoves += 1;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "Comment") {
      const comment = parseComment(token.value);

      if (comment.evaluation) {
        if (isPawns(comment.evaluation)) {
          root.score = {
            type: "cp",
            value: comment.evaluation.pawns * 100,
          };
        } else {
          root.score = {
            type: "mate",
            value: comment.evaluation.mate,
          };
        }
      }

      if (comment.shapes.length > 0) {
        const shapes: DrawShape[] = comment.shapes.map((shape) => ({
          orig: makeSquare(shape.from),
          dest: makeSquare(shape.to),
          brush: shape.color,
        }));
        root.shapes.push(...shapes);
      }

      if (comment.clock) {
        root.clock = comment.clock;
      }

      root.commentText = comment.text;
      root.commentHTML = comment.text;
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
        root.halfMoves - 1,
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

export async function parsePGN(
  pgn: string,
  initialFen?: string,
): Promise<TreeState> {
  const tokens = await invoke<Token[]>("lex_pgn", { pgn: pgn });

  const headers = getPgnHeaders(tokens);
  const tree = innerParsePGN(
    tokens,
    initialFen?.trim() || headers.fen.trim(),
    0,
  );
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
    TimeControl,
  } = Object.fromEntries(headersN);

  const headers: GameHeaders = {
    id: 0,
    fen: FEN ?? INITIAL_FEN,
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
    time_control: TimeControl,
  };
  return headers;
}

type TimeControlField = {
  seconds: number;
  increment?: number;
  moves?: number;
};

type TimeControl = TimeControlField[];

export function parseTimeControl(timeControl: string): TimeControl {
  const fields = timeControl.split(":");
  const timeControlFields: TimeControl = [];
  for (const field of fields) {
    const match = field.match(/(?:(\d+)\/)?(\d+)(?:\+(\d+))?/);
    if (!match) {
      continue;
    }
    const moves = match[1];
    const seconds = match[2];
    const increment = match[3];
    const timeControlField: TimeControlField = {
      seconds: parseInt(seconds),
    };
    if (increment) {
      timeControlField.increment = parseInt(increment);
    }
    if (moves) {
      timeControlField.moves = parseInt(moves);
    }
    timeControlFields.push(timeControlField);
  }
  return timeControlFields;
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
    white: [],
    black: [],
  };
  const accuracies: ColorMap<number[]> = {
    white: [],
    black: [],
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
    const color = tree.halfMoves % 2 == 1 ? "white" : "black";
    if (tree.score) {
      cplosses[color].push(getCPLoss(prevScore, tree.score, color));
      accuracies[color].push(getAccuracy(prevScore, tree.score, color));
      prevScore = tree.score;
    }
  }
  const whiteCPL = mean(cplosses.white);
  const blackCPL = mean(cplosses.black);
  const whiteAccuracy = harmonicMean(accuracies.white);
  const blackAccuracy = harmonicMean(accuracies.black);

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

export function getMaterialDiff(fen: string) {
  const res = parseFen(fen);
  if (res.isErr) {
    return null;
  }
  const board = res.unwrap().board;
  const { white, black } = board;

  const pieceDiff = (piece: Role) =>
    white.intersect(board[piece]).size() - black.intersect(board[piece]).size();

  const pieces = {
    p: pieceDiff("pawn"),
    n: pieceDiff("knight"),
    b: pieceDiff("bishop"),
    r: pieceDiff("rook"),
    q: pieceDiff("queen"),
  };

  const diff =
    pieces.p * 1 + pieces.n * 3 + pieces.b * 3 + pieces.r * 5 + pieces.q * 9;

  return { pieces, diff };
}
