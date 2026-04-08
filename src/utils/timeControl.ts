/** PGN-style `YYYY.MM.DD` (and ISO dates) → UTC ms. `Date` cannot parse dotted PGN dates reliably. */
export function parsePgnDateUtcMs(dateStr: string): number {
    const m = dateStr.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        return Date.UTC(y, mo - 1, d);
    }
    const t = Date.parse(dateStr);
    return Number.isNaN(t) ? 0 : t;
}

export function getTimeControl(website: string | null, timeControl: string) {
    const [initial, increment = 0] = timeControl.split("+").map(Number);
    if (website === "Chess.com") {
        if (timeControl.startsWith("1/")) {
            return "daily";
        }
        const total = initial + increment * 40;
        return total < 180 ? "bullet" : total <= 500 ? "blitz" : "rapid";
    }
    if (timeControl === "-") {
        return "correspondence";
    }
    // Lichess-style buckets (also used for En Croissant engine games)
    const total = initial + increment * 40;
    return total < 30
        ? "ultra_bullet"
        : total < 180
          ? "bullet"
          : total < 480
            ? "blitz"
            : total < 1500
              ? "rapid"
              : "classical";
}
