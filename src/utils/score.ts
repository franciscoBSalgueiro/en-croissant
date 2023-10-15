import { minMax } from "@tiptap/react";
import { Color } from "chess.js";
import { Annotation } from "./chess";
import { Score } from "@/bindings";

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

export function formatScore(score: Score, precision = 2): string {
    let scoreText = "";
    if (score.type === "cp") {
        scoreText = Math.abs(score.value / 100).toFixed(precision);
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
    return minMax(
        103.1668 *
            Math.exp(-0.04354 * (getWinChance(prevCP) - getWinChance(nextCP))) -
            3.1669 +
            1,
        0,
        100
    );
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
        return "??";
    } else if (winChanceDiff > 10) {
        return "?";
    } else if (winChanceDiff > 5) {
        return "?!";
    }
    return "";
}
