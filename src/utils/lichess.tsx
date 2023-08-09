import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Color } from "chessground/types";
import { invoke } from "./invoke";
import { NormalizedGame } from "./db";
import { parsePGN } from "./chess";
import { countMainPly } from "./treeReducer";
import { fetch, Response, ResponseType } from "@tauri-apps/api/http";

const base_url = "https://lichess.org/api";
const explorer_url = "https://explorer.lichess.ovh";

type LichessPerf = {
  games: number;
  rating: number;
  rd: number;
  prog: number;
  prov: boolean;
};

export type LichessAccount = {
  id: string;
  username: string;
  perfs: {
    chess960: LichessPerf;
    atomic: LichessPerf;
    racingKings: LichessPerf;
    ultraBullet: LichessPerf;
    blitz: LichessPerf;
    kingOfTheHill: LichessPerf;
    bullet: LichessPerf;
    correspondence: LichessPerf;
    horde: LichessPerf;
    puzzle: LichessPerf;
    classical: LichessPerf;
    rapid: LichessPerf;
    storm: {
      runs: number;
      score: number;
    };
  };
  createdAt: number;
  disabled: boolean;
  tosViolation: boolean;
  profile: {
    country: string;
    location: string;
    bio: string;
    firstName: string;
    lastName: string;
    fideRating: number;
    uscfRating: number;
    ecfRating: number;
    links: string;
  };
  seenAt: number;
  patron: boolean;
  verified: boolean;
  playTime: {
    total: number;
    tv: number;
  };
  title: string;
  url: string;
  playing: string;
  completionRate: number;
  count: {
    all: number;
    rated: number;
    ai: number;
    draw: number;
    drawH: number;
    loss: number;
    lossH: number;
    win: number;
    winH: number;
    bookmark: number;
    playing: number;
    import: number;
    me: number;
  };
  streaming: boolean;
  followable: boolean;
  following: boolean;
  blocking: boolean;
  followsYou: boolean;
};

type PositionGames = {
  uci: string;
  id: string;
  winner: string | null;
  speed: string;
  mode: string;
  black: {
    name: string;
    rating: number;
  };
  white: {
    name: string;
    rating: number;
  };
  year: number;
  month: string;
}[];

export async function convertToNormalized(
  data: PositionGames
): Promise<NormalizedGame[]> {
  return await Promise.all(
    data.map(async (game) => {
      const pgn = await getLichessGame(game.id);
      const { headers, root } = await parsePGN(pgn);
      const normalized: NormalizedGame = {
        ...headers,
        white_id: 0,
        black_id: 0,
        event_id: 0,
        site_id: 0,
        moves: pgn,
        ply_count: countMainPly(root),
        // ply_count: root,
      };
      return normalized;
    })
  );
}

type PositionData = {
  white: number;
  black: number;
  draws: number;
  moves: {
    uci: string;
    san: string;
    averageRating: number;
    white: number;
    black: number;
    draws: number;
  }[];
  recentGames: PositionGames;
  topGames: PositionGames;
};

function base64URLEncode(str: ArrayBuffer) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function createCodes() {
  const verifier = base64URLEncode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64URLEncode(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  return { verifier, challenge };
}

export async function getLichessAccount({
  token,
  username,
}: {
  token?: string;
  username?: string;
}): Promise<LichessAccount | null> {
  let response: Response<LichessAccount>;
  if (token) {
    response = await fetch<LichessAccount>(`${base_url}/account`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } else {
    const url = `${base_url}/user/${username}`;
    response = await fetch<LichessAccount>(url);
  }
  if (!response.ok) {
    notifications.show({
      title: "Failed to fetch Lichess account",
      message: 'Could not find account "' + username + '" on lichess.org',
      color: "red",
      icon: <IconX />,
    });
    return null;
  }
  return response.data;
}

export async function getCloudEvaluation(fen: string, multipv = 1) {
  const url = `${base_url}/cloud-eval?fen=${fen}&multipv=${multipv}`;
  return fetch(url);
}

export async function getLichessGames(fen: string): Promise<PositionData> {
  return (await fetch<PositionData>(`${explorer_url}/lichess?fen=${fen}`)).data;
}

export async function getMasterGames(fen: string): Promise<PositionData> {
  return (await fetch<PositionData>(`${explorer_url}/masters?fen=${fen}`)).data;
}

export async function getPlayerGames(
  fen: string,
  player: string,
  color: Color
) {
  return (
    await fetch(
      `${explorer_url}/player?fen=${fen}&player=${player}&color=${color}`
    )
  ).data;
}

export async function downloadLichess(
  player: string,
  timestamp: number | null,
  token?: string
) {
  let url = `${base_url}/games/user/${player}`;
  if (timestamp) {
    url += `?since=${timestamp}`;
  }
  const path = await resolve(await appDataDir(), "db", player + "_lichess.pgn");
  await invoke("download_file", {
    id: 1,
    url,
    zip: false,
    path,
    token,
  });
}

export async function getLichessGame(gameId: string): Promise<string> {
  return (
    await fetch<string>(`https://lichess.org/game/export/${gameId}`, {
      method: "GET",
      responseType: ResponseType.Text,
    })
  ).data;
}
