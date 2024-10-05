
// This file was generated by [tauri-specta](https://github.com/oscartbeaumont/tauri-specta). Do not edit this file manually.

/** user-defined commands **/


export const commands = {
async closeSplashscreen() : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("close_splashscreen") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async findFidePlayer(player: string) : Promise<Result<FidePlayer | null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("find_fide_player", { player }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getBestMoves(id: string, engine: string, tab: string, goMode: GoMode, options: EngineOptions) : Promise<Result<[number, BestMoves[]] | null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_best_moves", { id, engine, tab, goMode, options }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async analyzeGame(id: string, engine: string, goMode: GoMode, options: AnalysisOptions, uciOptions: EngineOption[]) : Promise<Result<MoveAnalysis[], string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("analyze_game", { id, engine, goMode, options, uciOptions }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async stopEngine(engine: string, tab: string) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("stop_engine", { engine, tab }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async killEngine(engine: string, tab: string) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("kill_engine", { engine, tab }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async killEngines(tab: string) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("kill_engines", { tab }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getEngineLogs(engine: string, tab: string) : Promise<Result<EngineLog[], string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_engine_logs", { engine, tab }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async memorySize() : Promise<number> {
    return await TAURI_INVOKE("memory_size");
},
async getPuzzle(file: string, minRating: number, maxRating: number) : Promise<Result<Puzzle, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_puzzle", { file, minRating, maxRating }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async searchOpeningName(query: string) : Promise<Result<OutOpening[], string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("search_opening_name", { query }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getOpeningFromFen(fen: string) : Promise<Result<string, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_opening_from_fen", { fen }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getOpeningFromName(name: string) : Promise<Result<string, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_opening_from_name", { name }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getPlayersGameInfo(file: string, id: number) : Promise<Result<PlayerGameInfo, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_players_game_info", { file, id }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getEngineConfig(path: string) : Promise<Result<EngineConfig, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_engine_config", { path }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async fileExists(path: string) : Promise<Result<boolean, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("file_exists", { path }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getFileMetadata(path: string) : Promise<Result<FileMetadata, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_file_metadata", { path }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async mergePlayers(file: string, player1: number, player2: number) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("merge_players", { file, player1, player2 }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async convertPgn(file: string, dbPath: string, timestamp: number | null, title: string, description: string | null) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("convert_pgn", { file, dbPath, timestamp, title, description }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getPlayer(file: string, id: number) : Promise<Result<Player | null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_player", { file, id }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async countPgnGames(file: string) : Promise<Result<number, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("count_pgn_games", { file }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async readGames(file: string, start: number, end: number) : Promise<Result<string[], string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("read_games", { file, start, end }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async lexPgn(pgn: string) : Promise<Result<Token[], string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("lex_pgn", { pgn }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async isBmi2Compatible() : Promise<boolean> {
    return await TAURI_INVOKE("is_bmi2_compatible");
},
async deleteGame(file: string, n: number) : Promise<Result<null, string>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("delete_game", { file, n }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
}
}

/** user-defined events **/


export const events = __makeEvents__<{
bestMovesPayload: BestMovesPayload,
databaseProgress: DatabaseProgress,
downloadProgress: DownloadProgress,
reportProgress: ReportProgress
}>({
bestMovesPayload: "best-moves-payload",
databaseProgress: "database-progress",
downloadProgress: "download-progress",
reportProgress: "report-progress"
})

/** user-defined constants **/



/** user-defined types **/

export type AnalysisOptions = { fen: string; moves: string[]; annotateNovelties: boolean; referenceDb: string | null; reversed: boolean }
export type BestMoves = { nodes: number; depth: number; score: Score; uciMoves: string[]; sanMoves: string[]; multipv: number; nps: number }
export type BestMovesPayload = { bestLines: BestMoves[]; engine: string; tab: string; fen: string; moves: string[]; progress: number }
export type DatabaseProgress = { id: string; progress: number }
export type DownloadProgress = { progress: number; id: string; finished: boolean }
export type EngineConfig = { name: string; options: UciOptionConfig[] }
export type EngineLog = { type: "gui"; value: string } | { type: "engine"; value: string }
export type EngineOption = { name: string; value: string }
export type EngineOptions = { fen: string; moves: string[]; extraOptions: EngineOption[] }
export type FidePlayer = { fideid: number; name: string; country: string; sex: string; title: string | null; w_title: string | null; o_title: string | null; foa_title: string | null; rating: number | null; games: number | null; k: number | null; rapid_rating: number | null; rapid_games: number | null; rapid_k: number | null; blitz_rating: number | null; blitz_games: number | null; blitz_k: number | null; birthday: number | null; flag: string | null }
export type FileMetadata = { last_modified: number }
export type GoMode = { t: "PlayersTime"; c: PlayersTime } | { t: "Depth"; c: number } | { t: "Time"; c: number } | { t: "Nodes"; c: number } | { t: "Infinite" }
export type MonthData = { count: number; avg_elo: number }
export type MoveAnalysis = { best: BestMoves[]; novelty: boolean; is_sacrifice: boolean }
export type OutOpening = { name: string; fen: string }
export type Player = { id: number; name: string | null; elo: number | null }
export type PlayerGameInfo = { won: number; lost: number; draw: number; data_per_month: ([string, MonthData])[]; white_openings: ([string, Results])[]; black_openings: ([string, Results])[] }
export type PlayersTime = { white: number; black: number; winc: number; binc: number }
export type Puzzle = { id: number; fen: string; moves: string; rating: number; rating_deviation: number; popularity: number; nb_plays: number }
export type ReportProgress = { progress: number; id: string; finished: boolean }
export type Results = { won: number; lost: number; draw: number }
export type Score = { value: ScoreValue; 
/**
 * The probability of each result (win, draw, loss).
 */
wdl: [number, number, number] | null }
export type ScoreValue = 
/**
 * The score in centipawns.
 */
{ type: "cp"; value: number } | 
/**
 * Mate coming up in this many moves. Negative value means the engine is getting mated.
 */
{ type: "mate"; value: number }
export type Token = { type: "ParenOpen" } | { type: "ParenClose" } | { type: "Comment"; value: string } | { type: "San"; value: string } | { type: "Header"; value: { tag: string; value: string } } | { type: "Nag"; value: string } | { type: "Outcome"; value: string }
/**
 * Represents a UCI option definition.
 */
export type UciOptionConfig = 
/**
 * The option of type `check` (a boolean).
 */
{ type: "check"; value: { 
/**
 * The name of the option.
 */
name: string; 
/**
 * The default value of this `bool` property.
 */
default: boolean | null } } | 
/**
 * The option of type `spin` (a signed integer).
 */
{ type: "spin"; value: { 
/**
 * The name of the option.
 */
name: string; 
/**
 * The default value of this integer property.
 */
default: bigint | null; 
/**
 * The minimal value of this integer property.
 */
min: bigint | null; 
/**
 * The maximal value of this integer property.
 */
max: bigint | null } } | 
/**
 * The option of type `combo` (a list of strings).
 */
{ type: "combo"; value: { 
/**
 * The name of the option.
 */
name: string; 
/**
 * The default value for this list of strings.
 */
default: string | null; 
/**
 * The list of acceptable strings.
 */
var: string[] } } | 
/**
 * The option of type `button` (an action).
 */
{ type: "button"; value: { 
/**
 * The name of the option.
 */
name: string } } | 
/**
 * The option of type `string` (a string, unsurprisingly).
 */
{ type: "string"; value: { 
/**
 * The name of the option.
 */
name: string; 
/**
 * The default value of this string option.
 */
default: string | null } }

/** tauri-specta globals **/

import {
	invoke as TAURI_INVOKE,
	Channel as TAURI_CHANNEL,
} from "@tauri-apps/api/core";
import * as TAURI_API_EVENT from "@tauri-apps/api/event";
import { type WebviewWindow as __WebviewWindow__ } from "@tauri-apps/api/webviewWindow";

type __EventObj__<T> = {
	listen: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.listen<T>>;
	once: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.once<T>>;
	emit: null extends T
		? (payload?: T) => ReturnType<typeof TAURI_API_EVENT.emit>
		: (payload: T) => ReturnType<typeof TAURI_API_EVENT.emit>;
};

export type Result<T, E> =
	| { status: "ok"; data: T }
	| { status: "error"; error: E };

function __makeEvents__<T extends Record<string, any>>(
	mappings: Record<keyof T, string>,
) {
	return new Proxy(
		{} as unknown as {
			[K in keyof T]: __EventObj__<T[K]> & {
				(handle: __WebviewWindow__): __EventObj__<T[K]>;
			};
		},
		{
			get: (_, event) => {
				const name = mappings[event as keyof T];

				return new Proxy((() => {}) as any, {
					apply: (_, __, [window]: [__WebviewWindow__]) => ({
						listen: (arg: any) => window.listen(name, arg),
						once: (arg: any) => window.once(name, arg),
						emit: (arg: any) => window.emit(name, arg),
					}),
					get: (_, command: keyof __EventObj__<any>) => {
						switch (command) {
							case "listen":
								return (arg: any) => TAURI_API_EVENT.listen(name, arg);
							case "once":
								return (arg: any) => TAURI_API_EVENT.once(name, arg);
							case "emit":
								return (arg: any) => TAURI_API_EVENT.emit(name, arg);
						}
					},
				});
			},
		},
	);
}
