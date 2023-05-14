import { minMax } from "@tiptap/react";
import { Color } from "chess.js";
import { Annotation } from "./chess";

export type Score = {
    type: "cp" | "mate";
    value: number;
};

export const INITIAL_SCORE: Score = {
    type: "cp",
    value: 15,
};

const CP_CEILING = 1000;

export function parseScore(score: string): Score {
    if (score.includes("M") || score.includes("#")) {
        return { type: "mate", value: parseInt(score.replace(/M|#/, "")) };
    } else {
        return { type: "cp", value: parseFloat(score) * 100 };
    }
}

export function formatScore(score: Score): string {
    let scoreText = "";
    if (score.type === "cp") {
        scoreText = Math.abs(score.value / 100).toFixed(2);
    } else {
        scoreText = "M" + Math.abs(score.value);
    }
    if (score.value > 0) {
        scoreText = "+" + scoreText;
    }
    if (score.value < 0) {
        scoreText = "-" + scoreText;
    }
    return scoreText;
}

export function getWinChance(centipawns: number) {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

export function getAccuracyfromCP(
    winChanceBefore: number,
    winChanceAfter: number
) {
    return Math.min(
        103.1668 * Math.exp(-0.04354 * (winChanceBefore - winChanceAfter)) -
        3.1669,
        100
    );
}

function normalizeScores(
    prev: Score,
    next: Score,
    color: Color
): { prevCP: number; nextCP: number } {
    let prevCP = prev.value;
    let nextCP = next.value;

    if (color == "b") {
        prevCP *= -1;
        nextCP *= -1;
    }

    if (prev.type == "mate") {
        prevCP = CP_CEILING * Math.sign(prevCP);
    }
    prevCP = minMax(prevCP, -CP_CEILING, CP_CEILING);

    if (next.type == "mate") {
        nextCP = CP_CEILING * Math.sign(nextCP);
    }

    nextCP = minMax(nextCP, -CP_CEILING, CP_CEILING);

    return { prevCP, nextCP };
}

export function getAccuracy(prev: Score, next: Score, color: Color): number {
    const { prevCP, nextCP } = normalizeScores(prev, next, color);
    return getAccuracyfromCP(getWinChance(prevCP), getWinChance(nextCP));
}

export function getCPLoss(prev: Score, next: Score, color: Color): number {
    const { prevCP, nextCP } = normalizeScores(prev, next, color);

    return Math.max(0, prevCP - nextCP);
}

export function getAnnotation(
    prev: Score,
    next: Score,
    color: Color
): Annotation {
    const { prevCP, nextCP } = normalizeScores(prev, next, color);
    const winChanceDiff = getWinChance(prevCP) - getWinChance(nextCP);

    if (winChanceDiff > 20) {
        return Annotation.Blunder;
    } else if (winChanceDiff > 10) {
        return Annotation.Mistake;
    } else if (winChanceDiff > 5) {
        return Annotation.Dubious;
    }
    return Annotation.None;
}
