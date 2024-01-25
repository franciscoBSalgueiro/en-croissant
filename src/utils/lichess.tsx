import { BestMoves, EngineOptions, GoMode } from "@/bindings";
import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { Response, fetch } from "@tauri-apps/api/http";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Color } from "chessground/types";
import { parseUci } from "chessops";
import { makeFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { error } from "tauri-plugin-log-api";
import { parsePGN } from "./chess";
import { positionFromFen } from "./chessops";
import { NormalizedGame } from "./db";
import { invoke } from "./invoke";
import {
  LichessGamesOptions,
  MasterGamesOptions,
  getLichessGamesQueryParams,
  getMasterGamesQueryParams,
} from "./lichess/lichessexplorer";
import { countMainPly } from "./treeReducer";

const baseURL = "https://lichess.org/api";
const explorerURL = "https://explorer.lichess.ovh";
const tablebaseURL = "https://tablebase.lichess.ovh";

type TablebaseData = {
  checkmate: boolean;
  stalemate: boolean;
  variant_win: boolean;
  variant_loss: boolean;
  insufficient_material: boolean;
  dtz: number;
  precise_dtz: number;
  dtm: number;
  category: "win" | "loss" | "draw" | "unknown";
  moves: TablebaseMove[];
};

type TablebaseMove = {
  uci: string;
  san: string;
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
  variant_win: boolean;
  variant_loss: boolean;
  insufficient_material: boolean;
  dtz: number;
  precise_dtz: number;
  dtm: number;
  category: "win" | "loss";
};

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
  perfs?: {
    chess960?: LichessPerf;
    atomic?: LichessPerf;
    racingKings?: LichessPerf;
    ultraBullet?: LichessPerf;
    blitz?: LichessPerf;
    kingOfTheHill?: LichessPerf;
    bullet?: LichessPerf;
    correspondence?: LichessPerf;
    horde?: LichessPerf;
    puzzle?: LichessPerf;
    classical?: LichessPerf;
    rapid?: LichessPerf;
    storm?: {
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
  data: PositionGames,
): Promise<NormalizedGame[]> {
  return await Promise.all(
    data.map(async (game, i) => {
      const pgn = await getLichessGame(game.id);
      const { headers, root } = await parsePGN(pgn);
      const normalized: NormalizedGame = {
        ...headers,
        id: i,
        white_id: 0,
        black_id: 0,
        event_id: 0,
        site_id: 0,
        moves: pgn,
        ply_count: countMainPly(root),
        // ply_count: root,
      };
      return normalized;
    }),
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

export async function getLichessAccount({
  token,
  username,
}: {
  token?: string;
  username?: string;
}): Promise<LichessAccount | null> {
  let response: Response<LichessAccount>;
  if (token) {
    response = await fetch<LichessAccount>(`${baseURL}/account`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } else {
    const url = `${baseURL}/user/${username}`;
    response = await fetch<LichessAccount>(url);
  }
  if (!response.ok) {
    error(
      `Failed to fetch Lichess account: ${response.status} ${response.url}`,
    );
    notifications.show({
      title: "Failed to fetch Lichess account",
      message: `Could not find account "${username}" on lichess.org`,
      color: "red",
      icon: <IconX />,
    });
    return null;
  }
  return response.data;
}

export async function getBestMoves(
  _tab: string,
  _goMode: GoMode,
  options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
  const [pos] = positionFromFen(options.fen);
  if (!pos) {
    return null;
  }
  for (const uci of options.moves) {
    const m = parseUci(uci);
    if (!m) {
      return null;
    }
    pos.play(m);
  }
  const data = await getCloudEvaluation(
    makeFen(pos.toSetup()),
    options.multipv,
  );
  return [
    100,
    data.pvs?.map((m, i) => {
      const uciMoves = m.moves.split(" ");

      const sanMoves = uciMoves.map((m) => {
        const move = parseUci(m)!;
        const san = makeSan(pos, move);
        pos.play(move);
        return san;
      });

      return {
        score: { type: "cp", value: m.cp },
        nodes: data.knodes * 1000,
        depth: data.depth,
        multipv: i + 1,
        nps: 0,
        sanMoves,
        uciMoves,
      };
    }) ?? [],
  ];
}

const cache = new Map<string, LichessCloudData>();

type LichessCloudData = {
  fen: string;
  knodes: number;
  depth: number;
  pvs: {
    moves: string;
    cp: number;
  }[];
};

async function getCloudEvaluation(fen: string, multipv: number) {
  if (cache.has(`${fen}-${multipv}`)) {
    return cache.get(`${fen}-${multipv}`)!;
  }
  const url = new URL(`${baseURL}/cloud-eval`);
  url.searchParams.append("fen", fen);
  url.searchParams.append("multiPv", multipv.toString());

  const response = await fetch<LichessCloudData>(url.toString());

  cache.set(`${fen}-${multipv}`, response.data);
  return response.data;
}

export async function getLichessGames(
  options: LichessGamesOptions,
): Promise<PositionData> {
  const url = `${explorerURL}/lichess?${getLichessGamesQueryParams(options)}`;
  return (await fetch<PositionData>(url)).data;
}

export async function getMasterGames(
  options: MasterGamesOptions,
): Promise<PositionData> {
  const url = `${explorerURL}/masters?${getMasterGamesQueryParams(options)}`;
  return (await fetch<PositionData>(url)).data;
}

export async function getPlayerGames(
  fen: string,
  player: string,
  color: Color,
) {
  return (
    await fetch(
      `${explorerURL}/player?fen=${fen}&player=${player}&color=${color}`,
    )
  ).data;
}

export async function downloadLichess(
  player: string,
  timestamp: number | null,
  token?: string,
) {
  let url = `${baseURL}/games/user/${player}?perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence&rated=true`;
  if (timestamp) {
    url += `&since=${timestamp}`;
  }
  const path = await resolve(await appDataDir(), "db", `${player}_lichess.pgn`);
  await invoke("download_file", {
    id: 1,
    url,
    path,
    token,
  });
}

export async function getLichessGame(gameId: string): Promise<string> {
  const response = await window.fetch(
    `https://lichess.org/game/export/${gameId.slice(0, 8)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Failed to load lichess game ${gameId} - ${response.statusText}`,
    );
  }
  return await response.text();
}

export async function getTablebaseInfo(fen: string) {
  const res = await fetch<TablebaseData>(`${tablebaseURL}/standard?fen=${fen}`);
  if (!res.ok) {
    throw new Error(`Failed to load tablebase info for ${fen} - ${res.status}`);
  }
  return res.data;
}
