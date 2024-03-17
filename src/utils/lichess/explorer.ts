import { z } from "zod";

const lichessVariant = z.enum([
  "standard",
  "chess960",
  "crazyhouse",
  "antichess",
  "atomic",
  "horde",
  "kingOfTheHill",
  "racingKings",
  "threeCheck",
  "fromPosition",
]);

const lichessGameSpeed = z.enum([
  "ultraBullet",
  "bullet",
  "blitz",
  "rapid",
  "classical",
  "correspondence",
]);
export type LichessGameSpeed = z.infer<typeof lichessGameSpeed>;

export type LichessRating =
  | 0
  | 1000
  | 1200
  | 1400
  | 1600
  | 1800
  | 2000
  | 2200
  | 2500;

export const lichessGamesOptionsSchema = z.object({
  //https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerLichess
  variant: lichessVariant.optional(),
  speeds: z.array(lichessGameSpeed).optional(),
  ratings: z
    .array(
      z.union([
        z.literal(0),
        z.literal(1000),
        z.literal(1200),
        z.literal(1400),
        z.literal(1600),
        z.literal(1800),
        z.literal(2000),
        z.literal(2200),
        z.literal(2500),
      ]),
    )
    .optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  moves: z.number().min(0).optional(),
  topGames: z.number().min(0).optional(),
  recentGames: z.number().min(0).optional(),
  player: z.string().optional(),
  color: z.enum(["white", "black"]),
});

export type LichessGamesOptions = z.infer<typeof lichessGamesOptionsSchema>;

export const masterOptionsSchema = z.object({
  //https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerMaster
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  moves: z.number().min(0).optional(),
  topGames: z.number().min(0).optional(),
});

export type MasterGamesOptions = z.infer<typeof masterOptionsSchema>;

export function getLichessGamesQueryParams(
  fen: string,
  options: LichessGamesOptions | undefined,
): string {
  const getDateQueryString = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}`;

  const params = new URLSearchParams();

  if (options) {
    params.append("fen", fen);
    if (options.player && options.color) {
      params.append("player", options.player);
      params.append("color", options.color);
    }
    if (options.variant) params.append("variant", options.variant);
    if (options.speeds && options.speeds.length > 0)
      params.append("speeds", options.speeds.join(","));
    if (options.ratings && options.ratings.length > 0)
      params.append("ratings", options.ratings.join(","));
    if (options.since)
      params.append("since", getDateQueryString(options.since));
    if (options.until)
      params.append("until", getDateQueryString(options.until));
    if (options.moves !== undefined && 0 <= options.moves)
      params.append("moves", options.moves.toString());
    if (
      options.topGames !== undefined &&
      0 <= options.topGames &&
      options.topGames <= 4
    )
      params.append("topGames", options.topGames.toString());
    if (
      options.recentGames !== undefined &&
      0 <= options.recentGames &&
      options.recentGames <= 4
    )
      params.append("recentGames", options.recentGames.toString());
  }
  return params.toString();
}

export function getMasterGamesQueryParams(
  fen: string,
  options: MasterGamesOptions | undefined,
): string {
  const getDateQueryString = (date: Date) => date.getFullYear().toString();

  const queryParams: string[] = [];
  if (options) {
    queryParams.push(`fen=${fen}`);
    if (options.since)
      queryParams.push(`since=${getDateQueryString(options.since)}`);
    if (options.until)
      queryParams.push(`until=${getDateQueryString(options.until)}`);
    if (options.moves !== undefined && 0 <= options.moves)
      queryParams.push(`moves=${options.moves}`);
    if (
      options.topGames !== undefined &&
      0 <= options.topGames &&
      options.topGames <= 15
    )
      queryParams.push(`topGames=${options.topGames}`);
  }
  return queryParams.join("&");
}
