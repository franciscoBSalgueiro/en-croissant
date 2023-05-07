import { Score } from "./chess";
export function formatNumber(value?: number): string {
    if (!value) return "0";
    return Intl.NumberFormat().format(value);
}

export function formatBytes(bytes?: number, decimals = 2) {
    if (!bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const secondsRemainder = seconds % 60;
    const minutesRemainder = minutes % 60;
    const hoursRemainder = hours % 24;

    const parts = [];

    if (days > 0) {
        parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    }

    if (hoursRemainder > 0) {
        parts.push(`${hoursRemainder} hour${hoursRemainder !== 1 ? "s" : ""}`);
    }

    if (minutesRemainder > 0) {
        parts.push(
            `${minutesRemainder} minute${minutesRemainder !== 1 ? "s" : ""}`
        );
    }

    if (secondsRemainder > 0) {
        parts.push(
            `${secondsRemainder} second${secondsRemainder !== 1 ? "s" : ""}`
        );
    }

    return parts.join(", ");
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

export function formatMove(orientation: string) {
    return orientation === "w" ? "white" : "black";
}
