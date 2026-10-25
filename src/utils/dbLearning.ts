import { commands, type SimilarGame } from "@/bindings";
import { unwrap } from "@/utils/unwrap";

export async function similarGames(file: string, fen: string, limit = 30): Promise<SimilarGame[]> {
    return unwrap(await commands.similarGames(file, fen, limit));
}
