import { Score, commands } from "@/bindings";
import { MantineColor } from "@mantine/core";
import { invoke } from "@tauri-apps/api";
import { DrawShape } from "chessground/draw";
import {
  Color,
  NormalMove,
  Role,
  makeSquare,
  makeUci,
  parseSquare,
} from "chessops";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { isPawns, parseComment } from "chessops/pgn";
import { makeSan, parseSan } from "chessops/san";
import { positionFromFen } from "./chessops";
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
  let s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  s = (s % 3600) % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${s.toLocaleString(
    "en",
    {
      minimumIntegerDigits: 2,
      maximumFractionDigits: 3,
    },
  )}`;
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

  if (tree.san) {
    if (isBlack) {
      if (opt.isFirst) {
        moveText += `${moveNumber}... `;
      }
    } else {
      moveText += `${moveNumber}. `;
    }
    moveText += tree.san;
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
        content += `[%csl ${squares
          .map((shape) => {
            return shape.brush[0].toUpperCase() + shape.orig;
          })
          .join(",")}]`;
      }
      if (arrows.length > 0) {
        content += `[%cal ${arrows
          .map((shape) => {
            return shape.brush[0].toUpperCase() + shape.orig + shape.dest;
          })
          .join(",")}]`;
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
      moves.push(makeUci(node.move));
    }
  }
  return moves;
}

export function getVariationLine(root: TreeNode, position: number[]): string[] {
  const moves = [];
  let node = root;
  const [chess] = positionFromFen(root.fen);
  if (!chess) {
    return [];
  }
  for (const pos of position) {
    node = node.children[pos];
    if (node.move) {
      const move = node.move as NormalMove;
      const uci = makeUci(node.move);
      const square = parseSquare(uci.substring(0, 2))!;
      const kingRole = chess.board.get(square)?.role;

      if (kingRole === "king") {
        if (uci === "e1h1" || uci === "e1a1") {
          moves.push(uci.endsWith("h1") ? "e1g1" : "e1c1");
        } else if (uci === "e8h8" || uci === "e8a8") {
          moves.push(uci.endsWith("h8") ? "e8g8" : "e8c8");
        } else {
          moves.push(uci);
        }
      } else {
        moves.push(uci);
      }
      chess.play(move);
    }
  }
  console.log(moves);
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
    pgn += `[FEN "${tree.fen}"]\n`;
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
  for (const variation of variationsPGN) {
    pgn += ` (${variation}) `;
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
    pgn += ` ${headers?.result}` ?? "*";
  }
  return pgn.trim();
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

  const [pos] = positionFromFen(fen);
  if (!pos) {
    return null;
  }
  const move = parseSan(pos, san);
  if (move) {
    return move;
  }
  const newSan = cleanSan(san);
  const newMove = parseSan(pos, newSan);
  if (newMove) {
    return newMove;
  }
  return null;
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
  }
  return res.data;
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
    } else if (token.type === "Nag") {
      root.annotation = NAG_INFO.get(token.value) || "";
    } else if (token.type === "San") {
      const [pos, error] = positionFromFen(root.fen);
      if (error) {
        continue;
      }
      const move = parseSan(pos, token.value);
      if (!move) {
        continue;
      }
      const san = makeSan(pos, move);
      pos.play(move);

      const newTree = createNode({
        fen: makeFen(pos.toSetup()),
        move,
        san,
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
    // biome-ignore lint/suspicious/noShadowRestrictedNames: this is a name from the PGN standard
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

export type TimeControlField = {
  seconds: number;
  increment?: number;
  moves?: number;
};

export type TimeControl = TimeControlField[];

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
      seconds: parseInt(seconds) * 1000,
    };
    if (increment) {
      timeControlField.increment = parseInt(increment) * 1000;
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
export function getGameStats(root: TreeNode) {
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

  if (root.children.length === 0) {
    return {
      whiteCPL: 0,
      blackCPL: 0,
      whiteAccuracy: 0,
      blackAccuracy: 0,
      whiteAnnotations,
      blackAnnotations,
    };
  }

  let prevScore: Score = root.score ?? INITIAL_SCORE;
  const cplosses: ColorMap<number[]> = {
    white: [],
    black: [],
  };
  const accuracies: ColorMap<number[]> = {
    white: [],
    black: [],
  };
  let node = root;
  while (node.children.length > 0) {
    node = node.children[0];
    if (node.annotation) {
      if (node.halfMoves % 2 === 1) {
        whiteAnnotations[node.annotation]++;
      } else {
        blackAnnotations[node.annotation]++;
      }
    }
    const color = node.halfMoves % 2 === 1 ? "white" : "black";
    if (node.score) {
      cplosses[color].push(getCPLoss(prevScore, node.score, color));
      accuracies[color].push(getAccuracy(prevScore, node.score, color));
      prevScore = node.score;
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
