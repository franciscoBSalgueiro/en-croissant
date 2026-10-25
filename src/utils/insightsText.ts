import type { PositionInsights } from "@/bindings";

/**
 * A single sentence of the natural-language position summary, expressed as an
 * i18n key plus optional interpolation params so the component can render it
 * with `t(bullet.key, bullet.params)`.
 */
export interface InsightsBullet {
    key: string;
    params?: Record<string, string | number>;
}

/** The most played move for the current position in the reference database. */
export interface TopMoveInfo {
    /** SAN of the move. */
    move: string;
    /** Number of games in which this move was played. */
    playCount: number;
    /** Total number of games matching the position. */
    totalGames: number;
}

const MAX_BULLETS = 4;

const defaultFormatNumber = (n: number) => new Intl.NumberFormat().format(n);

/**
 * Builds the list of summary sentences for the Insights panel. The output is
 * ordered by relevance: material balance, development lead, hanging pieces,
 * structure motif, castling, database popularity — capped at MAX_BULLETS.
 */
export function insightsBulletKeys(
    insights: PositionInsights,
    topMove?: TopMoveInfo | null,
    formatNumber: (n: number) => string = defaultFormatNumber,
): InsightsBullet[] {
    const bullets: InsightsBullet[] = [];

    const diff = insights.material_diff;
    if (diff > 0) {
        bullets.push({ key: "Insights.MaterialWhiteUp", params: { n: diff } });
    } else if (diff < 0) {
        bullets.push({ key: "Insights.MaterialBlackUp", params: { n: -diff } });
    } else {
        bullets.push({ key: "Insights.MaterialEqual" });
    }

    // Only call out a meaningful development lead; one extra developed minor
    // is noise compared with the material/hanging/motif facts.
    const developmentDiff = insights.white_minor_developed - insights.black_minor_developed;
    if (developmentDiff >= 2) {
        bullets.push({
            key: "Insights.WhiteDevelopedMore",
            params: {
                white: insights.white_minor_developed,
                black: insights.black_minor_developed,
            },
        });
    } else if (developmentDiff <= -2) {
        bullets.push({
            key: "Insights.BlackDevelopedMore",
            params: {
                white: insights.white_minor_developed,
                black: insights.black_minor_developed,
            },
        });
    }

    if (insights.hanging_white.length > 0) {
        bullets.push({
            key: "Insights.HangingWhite",
            params: { squares: insights.hanging_white.join(", ") },
        });
    }
    if (insights.hanging_black.length > 0) {
        bullets.push({
            key: "Insights.HangingBlack",
            params: { squares: insights.hanging_black.join(", ") },
        });
    }

    const motif = insights.structure.motifs[0];
    if (motif) {
        bullets.push({ key: "Insights.MotifBullet", params: { motif } });
    }

    if (insights.white_castled && insights.black_castled) {
        bullets.push({ key: "Insights.BothCastled" });
    } else if (insights.white_castled) {
        bullets.push({ key: "Insights.OnlyWhiteCastled" });
    } else if (insights.black_castled) {
        bullets.push({ key: "Insights.OnlyBlackCastled" });
    }

    if (topMove && topMove.totalGames > 0 && topMove.playCount > 0) {
        const percent = Math.round((topMove.playCount / topMove.totalGames) * 100);
        bullets.push({
            key: "Insights.TopMove",
            params: {
                move: topMove.move,
                percent,
                games: formatNumber(topMove.totalGames),
            },
        });
    }

    return bullets.slice(0, MAX_BULLETS);
}

/**
 * Stable i18n key for a pawn-structure motif label coming from the Rust
 * backend (e.g. "Isolated Queen's Pawn" -> "Insights.Motif.Isolated_Queen_s_Pawn").
 * The raw label is used as the translation fallback while the keys are not
 * extracted yet.
 */
export function motifTranslationKey(motif: string): string {
    const slug = motif.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return `Insights.Motif.${slug}`;
}
