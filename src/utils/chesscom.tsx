import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { writeTextFile } from "@tauri-apps/api/fs";
import { fetch } from "@tauri-apps/api/http";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { decodeTCN } from "./tcn";
import { error } from "tauri-plugin-log-api";
import { ChildNode, PgnNodeData, defaultGame, makePgn } from "chessops/pgn";
import { Chess } from "chessops";
import { makeSan } from "chessops/san";
import { z } from "zod";

const baseURL = "https://api.chess.com";
const headers = {
  "User-Agent": "EnCroissant",
};

const ChessComPerf = z.object({
  last: z.object({
    rating: z.number(),
    date: z.number(),
    rd: z.number(),
  }),
  record: z.object({
    win: z.number(),
    loss: z.number(),
    draw: z.number(),
  }),
});

const ChessComStatsSchema = z.object({
  chess_daily: ChessComPerf.optional(),
  chess_rapid: ChessComPerf.optional(),
  chess_blitz: ChessComPerf.optional(),
  chess_bullet: ChessComPerf.optional(),
});
export type ChessComStats = z.infer<typeof ChessComStatsSchema>;

type Archive = {
  archives: string[];
};

const ChessComPlayer = z.object({
  rating: z.number(),
  result: z.string(),
  username: z.string(),
});

const ChessComGames = z.object({
  games: z.array(
    z.object({
      url: z.string(),
      pgn: z.string().nullish(),
      time_control: z.string(),
      end_time: z.number(),
      rated: z.boolean(),
      initial_setup: z.string(),
      fen: z.string(),
      rules: z.string(),
      white: ChessComPlayer,
      black: ChessComPlayer,
    })
  ),
});

export async function getChessComAccount(
  player: string
): Promise<ChessComStats | null> {
  const url = `${baseURL}/pub/player/${player.toLowerCase()}/stats`;
  const response = await fetch(url, { headers, method: "GET" });
  if (!response.ok) {
    error(
      `Failed to fetch Chess.com account: ${response.status} ${response.url}`
    );
    notifications.show({
      title: "Failed to fetch Chess.com account",
      message: 'Could not find account "' + player + '" on chess.com',
      color: "red",
      icon: <IconX />,
    });
    return null;
  }
  const data = await response.data;
  const stats = ChessComStatsSchema.safeParse(data);
  if (!stats.success) {
    error(
      `Invalid response for Chess.com account: ${response.status} ${response.url}\n${stats.error}`
    );
    notifications.show({
      title: "Failed to fetch Chess.com account",
      message: 'Invalid response for "' + player + '" on chess.com',
      color: "red",
      icon: <IconX />,
    });
    return null;
  }
  return stats.data;
}

async function getGameArchives(player: string) {
  const url = `${baseURL}/pub/player/${player}/games/archives`;
  const response = await fetch<Archive>(url, { headers, method: "GET" });
  return response.data;
}

export async function downloadChessCom(
  player: string,
  timestamp: number | null
) {
  let totalPGN = "";
  const timestampDate = new Date(timestamp ?? 0);
  const approximateDate = new Date(
    timestampDate.getFullYear(),
    timestampDate.getMonth(),
    1
  );
  const archives = await getGameArchives(player);
  for (const archive of archives.archives) {
    const [year, month] = archive.split("/").slice(-2);
    const archiveDate = new Date(parseInt(year), parseInt(month) - 1);
    if (archiveDate < approximateDate) {
      continue;
    }
    const response = await fetch(archive, {
      headers,
      method: "GET",
    });
    const games = ChessComGames.safeParse(await response.data);

    if (!games.success) {
      error(
        `Failed to fetch Chess.com games: ${response.status} ${response.url}`
      );
      notifications.show({
        title: "Failed to fetch Chess.com games",
        message:
          'Could not find games for "' +
          player +
          '" on chess.com for ' +
          archive,
        color: "red",
        icon: <IconX />,
      });
      return;
    }

    for (const game of games.data.games.filter((g) => g.pgn)) {
      totalPGN += "\n" + game.pgn;
    }
  }
  writeTextFile(
    await resolve(await appDataDir(), "db", player + "_chesscom.pgn"),
    totalPGN
  );
}

export async function getChesscomGame(gameURL: string) {
  const regex = /.*\/game\/(live|daily)\/(\d+)/;
  const match = gameURL.match(regex);

  if (!match) {
    return "";
  }

  const gameType = match[1];
  const gameId = match[2];

  const apiData = await fetch<{
    game: { moveList: string; pgnHeaders: Record<string, string | number> };
  }>(`https://www.chess.com/callback/${gameType}/game/${gameId}`, {
    headers,
    method: "GET",
  });
  const apiDataJson = await apiData.data;
  const moveList = apiDataJson.game.moveList;
  const pgnHeaders = apiDataJson.game.pgnHeaders;
  const moves = moveList.match(/.{1,2}/g);
  if (!moves) {
    return "";
  }
  const game = defaultGame<PgnNodeData>(
    () => new Map(Object.entries(pgnHeaders).map(([k, v]) => [k, v.toString()]))
  );
  const chess = Chess.default();

  let lastNode = game.moves;
  moves.forEach((move) => {
    const m = decodeTCN(move);
    lastNode.children.push(
      new ChildNode({
        san: makeSan(chess, m),
      })
    );
    chess.play(m);
    lastNode = lastNode.children[0];
  });

  return makePgn(game);
}

export function getStats(stats: ChessComStats) {
  const statsArray = [];
  if (stats.chess_bullet) {
    statsArray.push({
      value: stats.chess_bullet.last.rating,
      label: "Bullet",
    });
  }
  if (stats.chess_blitz) {
    statsArray.push({
      value: stats.chess_blitz.last.rating,
      label: "Blitz",
    });
  }
  if (stats.chess_rapid) {
    statsArray.push({
      value: stats.chess_rapid.last.rating,
      label: "Rapid",
    });
  }
  if (stats.chess_daily) {
    statsArray.push({
      value: stats.chess_daily.last.rating,
      label: "Daily",
    });
  }
  return statsArray;
}
