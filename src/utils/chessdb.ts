import { EngineOptions, GoMode } from "@/bindings";
import { Engine } from "@/utils/engines";
import { fetch } from "@tauri-apps/api/http";

const endpoint = "https://www.chessdb.cn/cdb.php";

type Response = {
    status: string;
    moves: ChessDBData[];
};

type ChessDBData = {
    uci: string;
    san: string;
    score: number;
    rank: number;
    note: string;
    winrate?: string;
};

export const chessdb: Engine = {
    name: "ChessDB",
    remote: true,
    loaded: false,
    stop: () => Promise.resolve(),
    getBestMoves: async (
        _tab: string,
        _goMode: GoMode,
        options: EngineOptions
    ) => {
        const moves = await queryPosition(options.fen);
        return [
            100,
            moves.slice(0, options.multipv).map((m, i) => ({
                score: { type: "cp", value: m.score },
                nodes: 0,
                depth: 0,
                multipv: i + 1,
                nps: 0,
                sanMoves: [m.san],
                uciMoves: [m.uci],
            })),
        ];
    },
};

const cache = new Map<string, ChessDBData[]>();

async function queryPosition(fen: string): Promise<ChessDBData[]> {
    if (cache.has(fen)) {
        return cache.get(fen)!;
    }
    const url = new URL(endpoint);
    url.searchParams.append("action", "queryall");
    url.searchParams.append("json", "1");
    url.searchParams.append("board", fen);
    const res = await fetch<Response>(url.toString());

    const side = fen.split(" ")[1];

    let data: ChessDBData[] = [];
    if (res.data.status === "ok") {
        data = res.data.moves;
    }

    if (side === "b") {
        data.forEach((m) => {
            m.score *= -1;
        });
    }

    cache.set(fen, data);
    return data;
}
