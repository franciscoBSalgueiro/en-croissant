import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { writeTextFile } from "@tauri-apps/api/fs";
import { fetch } from "@tauri-apps/api/http";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Chess } from "chess.js";
import { handleMove } from "./chess";
import { decodeTCN } from "./tcn";
import { error } from "tauri-plugin-log-api";
const baseURL = "https://api.chess.com";
const headers = {
  "User-Agent": "EnCroissant",
};

type ChessComPerf = {
  last: {
    rating: number;
    date: number;
    rd: number;
  };
  record: {
    win: number;
    loss: number;
    draw: number;
  };
};

export type ChessComStats = {
  chess_daily: ChessComPerf;
  chess_rapid: ChessComPerf;
  chess_blitz: ChessComPerf;
  chess_bullet: ChessComPerf;
};

type Archive = {
  archives: string[];
};

type ChessComPlayer = {
  rating: number;
  result: string;
  username: string;
};

type ChessComGames = {
  games: {
    url: string;
    pgn: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    initial_setup: string;
    fen: string;
    rules: string;
    white: ChessComPlayer;
    black: ChessComPlayer;
  }[];
};

export async function getChessComAccount(
  player: string
): Promise<ChessComStats | null> {
  const url = `${baseURL}/pub/player/${player.toLowerCase()}/stats`;
  const response = await fetch<ChessComStats>(url, { headers, method: "GET" });
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
  return await response.data;
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
    const response = await fetch<ChessComGames>(archive);
    const games = await response.data;
    for (const game of games.games) {
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
    game: { moveList: string; pgnHeaders: Record<string, string> };
  }>(`https://www.chess.com/callback/${gameType}/game/${gameId}`);
  const apiDataJson = await apiData.data;
  const moveList = apiDataJson.game.moveList;
  const headers = apiDataJson.game.pgnHeaders;
  const moves = moveList.match(/.{1,2}/g);
  if (!moves) {
    return "";
  }
  const chess = new Chess();
  for (const header of Object.keys(headers)) {
    chess.header(header, headers[header]);
  }
  moves.forEach((move) => {
    const m = decodeTCN(move);
    const newDest = handleMove(chess, m.from, m.to);
    m.to = newDest;
    chess.move(m);
  });
  return chess.pgn();
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
