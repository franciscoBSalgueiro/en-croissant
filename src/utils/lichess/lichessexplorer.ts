export type LichessGamesOptions = {
    //https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerLichess
    variant?: LichessVariant;
    speeds?: LichessGameSpeed[];
    ratings?: LichessRating[];
    since?: Date;
    until?: Date;
    moves?: number;
    topGames?: number;
    recentGames?: number;
}

export type MasterGamesOptions = {
    //https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerMaster
    since?: Date;
    until?: Date;
    moves?: number;
    topGames?: number;
}

export function getLichessGamesQueryParams(options: LichessGamesOptions | undefined): string[] {
    const queryParams: string[] = [];
    if (options) {
        if (options.variant)
            queryParams.push(`variant=${options.variant}`);
        if (options.speeds && options.speeds.length > 0)
            queryParams.push(`speeds=${options.speeds.join(',')}`);
        if (options.ratings && options.ratings.length > 0)
            queryParams.push(`ratings=${options.ratings.join(',')}`);
        if (options.since)
            queryParams.push(`since=${getDateQueryString(options.since)}`);
        if (options.until)
            queryParams.push(`until=${getDateQueryString(options.until)}`);
        if (options.moves != undefined && 0 <= options.moves)
            queryParams.push(`moves=${options.moves}`);
        if (options.topGames != undefined && 0 <= options.topGames && options.topGames <= 4)
            queryParams.push(`topGames=${options.topGames}`);
        if (options.recentGames != undefined && 0 <= options.recentGames && options.recentGames <= 4)
            queryParams.push(`recentGames=${options.recentGames}`)
    }
    return queryParams;
}

export function getMasterGamesQueryParams(options: MasterGamesOptions | undefined): string[] {
    const queryParams: string[] = [];
    if (options) {
        if (options.since)
            queryParams.push(`since=${getDateQueryString(options.since)}`);
        if (options.until)
            queryParams.push(`until=${getDateQueryString(options.until)}`);
        if (options.moves != undefined && 0 <= options.moves)
            queryParams.push(`moves=${options.moves}`);
        if (options.topGames != undefined && 0 <= options.topGames && options.topGames <= 15)
            queryParams.push(`topGames=${options.topGames}`);
    }
    return queryParams;
}

function getDateQueryString(date: Date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

export type LichessVariant = 
    "standard" |
    "chess960" |
    "crazyhouse" |
    "antichess" |
    "atomic" |
    "horde" |
    "kingOfTheHill" |
    "racingKings" |
    "threeCheck" |
    "fromPosition";

export type LichessGameSpeed =
    "ultrabullet" |
    "bullet" |
    "blitz" |
    "rapid" |
    "classical" |
    "correspondence";

export type LichessRating =
    0 |
    1000 |
    1200 |
    1400 |
    1600 |
    1800 |
    2000 |
    2200 |
    2500;