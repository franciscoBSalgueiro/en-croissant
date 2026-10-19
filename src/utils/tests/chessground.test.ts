import { defaults } from "@lichess-org/chessground/state";
import { expect, test } from "vitest";
import { pieceAnimation } from "@/chessground/Chessground";

test("Normal keeps the board's default speed, so nothing changes unless another speed is picked", () => {
    expect(pieceAnimation("normal", { enabled: true })).toEqual({
        enabled: true,
        duration: defaults().animation.duration,
    });
});

test("Fast is Lichess's Fast (120 ms), and Slow is twice Normal, as on Lichess", () => {
    const normal = pieceAnimation("normal", { enabled: true })!.duration!;

    expect(pieceAnimation("fast", { enabled: true })!.duration).toBe(120);
    expect(pieceAnimation("slow", { enabled: true })!.duration! / normal).toBe(2);
});

test("None turns the piece animation off", () => {
    expect(pieceAnimation("none", { enabled: true })!.enabled).toBe(false);
});

test("a board that doesn't set its animation (e.g. a preview) animates at the chosen speed", () => {
    expect(pieceAnimation("slow", undefined)).toEqual({
        enabled: true,
        duration: pieceAnimation("slow", { enabled: true })!.duration,
    });
});

test("a board that turns its animation off (e.g. while editing the position) keeps it off at any speed", () => {
    for (const speed of ["none", "fast", "normal", "slow"] as const) {
        expect(pieceAnimation(speed, { enabled: false })!.enabled).toBe(false);
    }
});
