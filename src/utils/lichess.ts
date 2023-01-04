import { Color } from "chessground/types";
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

function base64URLEncode(str: ArrayBuffer) {
    return Buffer.from(str)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export async function createCodes() {
    const verifier = base64URLEncode(
        crypto.getRandomValues(new Uint8Array(32))
    );
    const challenge = base64URLEncode(
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier)
        )
    );
    return { verifier, challenge };
}

async function getJson(url: string) {
    const response = await fetch(url);
    return await response.json();
}

export async function getMyAccount(token: string) {
    const url = `${base_url}/account`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return (await response.json()) as LichessAccount;
}

export async function getCloudEvaluation(fen: string, multipv: number = 1) {
    const url = `${base_url}/cloud-eval?fen=${fen}&multipv=${multipv}`;
    return getJson(url);
}

export async function getGames(fen: string) {
    const url = `${explorer_url}/lichess?fen=${fen}`;
    return getJson(url);
}

export async function getMasterGames(fen: string) {
    const url = `${explorer_url}/masters?fen=${fen}`;
    return getJson(url);
}

export async function getPlayerGames(
    fen: string,
    player: string,
    color: Color
) {
    const url = `${explorer_url}/player?fen=${fen}&player=${player}&color=${color}`;
    return getJson(url);
}
