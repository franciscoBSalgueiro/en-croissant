import { PgnParser, makePgn, type Game, type PgnNodeData, type Node } from "chessops/pgn";
import type { Token } from "@/bindings";

export function readPgn(text: string, maximumBytes?: number): Game<PgnNodeData>[] {
    if (maximumBytes !== undefined && new TextEncoder().encode(text).byteLength > maximumBytes)
        throw new Error("The file exceeds 16 MB. Split it into smaller files.");
    const games: Game<PgnNodeData>[] = [];
    const parser = new PgnParser((game, error) => {
        if (error) throw error;
        games.push(game);
    });
    parser.parse(text);
    if (!games.length || !text.trim()) throw new Error("The file contains no PGN games.");
    return games;
}
export const writePgn = (game: Game<PgnNodeData>) => makePgn(game);

// Compatibility boundary for the rich desktop tree parser (clocks, evaluations,
// arrows, NAGs, repertoire headers). Parsing no longer requires a Rust command.
export function tokenizePgn(text: string): Token[] {
    if (!text.trim()) return [];
    const game = readPgn(text)[0];
    const tokens: Token[] = [...game.headers].map(([tag, value]) => ({
        type: "Header",
        value: { tag, value },
    }));
    for (const value of game.comments ?? []) tokens.push({ type: "Comment", value });
    type Task =
        | { type: "line"; node: Node<PgnNodeData> }
        | { type: "move"; data: PgnNodeData }
        | { type: "token"; token: Token };
    const pending: Task[] = [{ type: "line", node: game.moves }];
    while (pending.length) {
        const task = pending.pop()!;
        if (task.type === "token") {
            tokens.push(task.token);
            continue;
        }
        if (task.type === "move") {
            for (const value of task.data.startingComments ?? [])
                tokens.push({ type: "Comment", value });
            tokens.push({ type: "San", value: task.data.san });
            for (const value of task.data.nags ?? [])
                tokens.push({ type: "Nag", value: `$${value}` });
            for (const value of task.data.comments ?? []) tokens.push({ type: "Comment", value });
            continue;
        }
        const first = task.node.children[0];
        if (!first) continue;
        pending.push({ type: "line", node: first });
        for (let i = task.node.children.length - 1; i > 0; i--) {
            const variation = task.node.children[i];
            pending.push(
                { type: "token", token: { type: "ParenClose" } },
                { type: "line", node: variation },
                { type: "move", data: variation.data },
                { type: "token", token: { type: "ParenOpen" } },
            );
        }
        pending.push({ type: "move", data: first.data });
    }
    const result = game.headers.get("Result") ?? "*";
    if (["*", "1-0", "0-1", "1/2-1/2"].includes(result))
        tokens.push({ type: "Outcome", value: result as "*" | "1-0" | "0-1" | "1/2-1/2" });
    return tokens;
}
