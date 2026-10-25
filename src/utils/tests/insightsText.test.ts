import { describe, expect, test } from "vitest";
import type { PositionInsights } from "@/bindings";
import { insightsBulletKeys, motifTranslationKey } from "../insightsText";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function makeInsights(overrides: Partial<PositionInsights> = {}): PositionInsights {
    return {
        material_diff: 0,
        white_castled: true,
        black_castled: true,
        white_minor_developed: 4,
        black_minor_developed: 3,
        hanging_white: [],
        hanging_black: [],
        structure: {
            fen: START_FEN,
            motifs: [],
            features: {
                white_doubled: 0,
                black_doubled: 0,
                white_isolated: 0,
                black_isolated: 0,
                white_passed: 0,
                black_passed: 0,
                white_islands: 1,
                black_islands: 1,
                open_files: [],
                semi_open_white: [],
                semi_open_black: [],
            },
        },
        ...overrides,
    };
}

// locale-independent number formatter for assertions
const fmt = (n: number) => `N${n}`;

describe("insightsBulletKeys", () => {
    test("material equal", () => {
        const bullets = insightsBulletKeys(makeInsights());
        expect(bullets).toHaveLength(2);
        expect(bullets[0]).toEqual({ key: "Insights.MaterialEqual" });
        // both castled by default
        expect(bullets[1]).toEqual({ key: "Insights.BothCastled" });
    });

    test("white is up material", () => {
        const bullets = insightsBulletKeys(makeInsights({ material_diff: 2 }));
        expect(bullets[0]).toEqual({ key: "Insights.MaterialWhiteUp", params: { n: 2 } });
    });

    test("black is up material with positive param", () => {
        const bullets = insightsBulletKeys(makeInsights({ material_diff: -3 }));
        expect(bullets[0]).toEqual({ key: "Insights.MaterialBlackUp", params: { n: 3 } });
    });

    test("castling variants", () => {
        expect(
            insightsBulletKeys(makeInsights({ white_castled: false })).map((b) => b.key),
        ).toContain("Insights.OnlyBlackCastled");
        expect(
            insightsBulletKeys(makeInsights({ black_castled: false })).map((b) => b.key),
        ).toContain("Insights.OnlyWhiteCastled");
        const none = insightsBulletKeys(
            makeInsights({ white_castled: false, black_castled: false }),
        );
        expect(none.map((b) => b.key)).not.toContain("Insights.BothCastled");
        expect(none.map((b) => b.key)).not.toContain("Insights.OnlyWhiteCastled");
        expect(none.map((b) => b.key)).not.toContain("Insights.OnlyBlackCastled");
    });

    test("development lead of two or more minors", () => {
        const white = insightsBulletKeys(
            makeInsights({ white_minor_developed: 4, black_minor_developed: 1 }),
        );
        expect(white[1]).toEqual({
            key: "Insights.WhiteDevelopedMore",
            params: { white: 4, black: 1 },
        });

        const black = insightsBulletKeys(
            makeInsights({ white_minor_developed: 1, black_minor_developed: 4 }),
        );
        expect(black[1]).toEqual({
            key: "Insights.BlackDevelopedMore",
            params: { white: 1, black: 4 },
        });

        // A one-piece lead is noise and should not produce a bullet.
        const close = insightsBulletKeys(
            makeInsights({ white_minor_developed: 4, black_minor_developed: 3 }),
        );
        expect(close.map((b) => b.key)).not.toContain("Insights.WhiteDevelopedMore");
    });

    test("hanging pieces per color", () => {
        const bullets = insightsBulletKeys(
            makeInsights({
                hanging_white: ["d3", "h2"],
                hanging_black: ["d5"],
            }),
        );
        expect(bullets[1]).toEqual({
            key: "Insights.HangingWhite",
            params: { squares: "d3, h2" },
        });
        expect(bullets[2]).toEqual({
            key: "Insights.HangingBlack",
            params: { squares: "d5" },
        });
    });

    test("uses the first structure motif", () => {
        const bullets = insightsBulletKeys(
            makeInsights({
                structure: {
                    fen: START_FEN,
                    motifs: ["Open Center", "Symmetrical Structure"],
                    features: makeInsights().structure.features,
                },
            }),
        );
        expect(bullets).toContainEqual({
            key: "Insights.MotifBullet",
            params: { motif: "Open Center" },
        });
    });

    test("top move bullet with rounded percent and formatted game count", () => {
        const bullets = insightsBulletKeys(
            makeInsights({ white_castled: false, black_castled: false }),
            { move: "Nf3", playCount: 3000, totalGames: 12340 },
            fmt,
        );
        expect(bullets[bullets.length - 1]).toEqual({
            key: "Insights.TopMove",
            params: { move: "Nf3", percent: 24, games: "N12340" },
        });
    });

    test("top move skipped when there are no games", () => {
        const bullets = insightsBulletKeys(makeInsights(), {
            move: "Nf3",
            playCount: 0,
            totalGames: 0,
        });
        expect(bullets.map((b) => b.key)).not.toContain("Insights.TopMove");
    });

    test("caps the summary at 4 bullets, prioritizing material and hanging", () => {
        const bullets = insightsBulletKeys(
            makeInsights({
                material_diff: 2,
                hanging_white: ["a2"],
                hanging_black: ["b7"],
                structure: {
                    fen: START_FEN,
                    motifs: ["Carlsbad Structure"],
                    features: makeInsights().structure.features,
                },
            }),
            { move: "e4", playCount: 10, totalGames: 20 },
        );
        expect(bullets).toHaveLength(4);
        expect(bullets.map((b) => b.key)).toEqual([
            "Insights.MaterialWhiteUp",
            "Insights.HangingWhite",
            "Insights.HangingBlack",
            "Insights.MotifBullet",
        ]);
    });
});

describe("motifTranslationKey", () => {
    test("sanitizes motif labels into stable keys", () => {
        expect(motifTranslationKey("Isolated Queen's Pawn")).toBe(
            "Insights.Motif.Isolated_Queen_s_Pawn",
        );
        expect(motifTranslationKey("Carlsbad Structure")).toBe("Insights.Motif.Carlsbad_Structure");
        expect(motifTranslationKey("Passed Pawn(s)")).toBe("Insights.Motif.Passed_Pawn_s");
    });
});
