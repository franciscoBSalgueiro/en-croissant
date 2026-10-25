import { commands, type ModelGamesReport } from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { unwrap } from "@/utils/unwrap";

export async function modelGames(options: LocalOptions): Promise<ModelGamesReport> {
    return unwrap(
        await commands.modelGames(options.path!, {
            player1: options.color === "white" ? options.player : undefined,
            player2: options.color === "black" ? options.player : undefined,
            position: {
                fen: options.fen,
                type_: options.type,
            },
            start_date: options.start_date,
            end_date: options.end_date,
            wanted_result: options.result,
        }),
    );
}
