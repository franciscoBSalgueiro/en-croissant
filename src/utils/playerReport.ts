import { commands, type PlayerReport } from "@/bindings";
import { unwrap } from "./unwrap";

export async function playerReport(file: string, playerId: number): Promise<PlayerReport> {
    return unwrap(await commands.playerReport(file, playerId));
}
