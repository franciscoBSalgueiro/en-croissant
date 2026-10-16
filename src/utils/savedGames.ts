import type { GameConfig, GameState, GameStatus, PlayerConfig } from "@/bindings";
import type { OpponentSettings } from "@/components/boards/OpponentForm";
import { INITIAL_FEN } from "chessops/fen";
import { ChildNode, Node, makePgn, type Game, type PgnNodeData } from "chessops/pgn";
import { readPgn } from "./pgn";

export interface SavedGame {
    version: number;
    id: string;
    startedAt: number;
    updatedAt: number;
    config: GameConfig & { sourcePgn?: string | null };
    state: GameState;
}
export interface SavedGameSummary {
    id: string;
    startedAt: number;
    updatedAt: number;
    white: string;
    black: string;
    status: GameStatus;
    ply: number;
    activeGameId: string | null;
}
export function savedGameResult(status: GameStatus): "*" | "1-0" | "0-1" | "1/2-1/2" {
    if (status === "playing") return "*";
    return status.finished.result.type === "whiteWins"
        ? "1-0"
        : status.finished.result.type === "blackWins"
          ? "0-1"
          : "1/2-1/2";
}
export function savedGamePgn(game: SavedGame): string {
    const whiteEngine = game.config.white.type === "engine";
    const blackEngine = game.config.black.type === "engine";
    const event =
        whiteEngine && blackEngine
            ? "Engine Match"
            : whiteEngine || blackEngine
              ? "Player vs Engine"
              : "Player Match";
    const date = new Date(Number(game.startedAt)).toISOString();
    let source: Game<PgnNodeData> | undefined;
    try {
        if (game.config.sourcePgn) {
            const candidate = readPgn(game.config.sourcePgn)[0];
            const variant = candidate.headers.get("Variant");
            if (
                (!variant || variant === "Standard") &&
                (candidate.headers.get("FEN") ?? INITIAL_FEN) === game.state.initialFen
            )
                source = candidate;
        }
    } catch {
        // Unsupported source PGN must not prevent recovering the native move list.
    }
    const headers = new Map(source?.headers);
    for (const [key, value] of [
        ["Event", event],
        ["Site", "En Croissant"],
        ["White", game.state.whitePlayer],
        ["Black", game.state.blackPlayer],
        ["Date", date.slice(0, 10).replaceAll("-", ".")],
        ["UTCTime", date.slice(11, 19)],
        ["Result", savedGameResult(game.state.status)],
        ["Orientation", blackEngine ? "white" : whiteEngine ? "black" : "white"],
    ])
        headers.set(key, value);
    headers.delete("TimeControl");
    headers.delete("WhiteTimeControl");
    headers.delete("BlackTimeControl");
    headers.delete("Termination");
    if (game.state.initialFen !== INITIAL_FEN) {
        headers.set("FEN", game.state.initialFen);
        headers.set("SetUp", "1");
    }
    const timeControl = (time: GameConfig["whiteTimeControl"]) =>
        time ? `${Number(time.initialTime) / 1000}+${Number(time.increment) / 1000}` : "-";
    const whiteTime = timeControl(game.config.whiteTimeControl);
    const blackTime = timeControl(game.config.blackTimeControl);
    if (whiteTime === blackTime) headers.set("TimeControl", whiteTime);
    else {
        headers.set("WhiteTimeControl", whiteTime);
        headers.set("BlackTimeControl", blackTime);
    }
    if (game.state.status !== "playing")
        headers.set("Termination", game.state.status.finished.result.reason);
    const moves = new Node<PgnNodeData>();
    let parent = moves;
    let sourceNode = source?.moves;
    let whiteToMove = game.state.initialFen.split(" ")[1] === "w";
    for (const move of game.state.moves) {
        const original = sourceNode?.children.find((child) => child.data.san === move.san);
        sourceNode = original;
        const comments = (original?.data.comments ?? [])
            .map((comment) => comment.replace(/\[%clk[^\]]*\]/g, " ").trim())
            .filter(Boolean);
        const clock = whiteToMove ? move.whiteTime : move.blackTime;
        if (clock !== null) {
            const seconds = Number(clock) / 1000;
            comments.push(
                `[%clk ${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${(seconds % 60).toFixed(3).padStart(6, "0")}]`,
            );
        }
        const node = new ChildNode<PgnNodeData>({
            san: move.san,
            comments,
            nags: original?.data.nags,
            startingComments: original?.data.startingComments,
        });
        parent.children.push(node);
        parent = node;
        whiteToMove = !whiteToMove;
    }
    return makePgn({ headers, moves, comments: source?.comments });
}
export function savedGamePlayers(config: GameConfig): {
    white: OpponentSettings;
    black: OpponentSettings;
} {
    const player = (
        value: PlayerConfig,
        time: GameConfig["whiteTimeControl"],
    ): OpponentSettings => {
        const timeControl = time
            ? { seconds: Number(time.initialTime), increment: Number(time.increment) }
            : undefined;
        if (value.type === "human") return { type: "human", name: value.name, timeControl };
        return {
            type: "engine",
            timeControl,
            go: value.go ?? { t: "Depth", c: 20 },
            engine: {
                type: "local",
                id: value.path,
                name: value.name,
                path: value.path,
                version: "",
                settings: value.options,
            },
            engineSettings: value.options,
        };
    };
    return {
        white: player(config.white, config.whiteTimeControl),
        black: player(config.black, config.blackTimeControl),
    };
}
