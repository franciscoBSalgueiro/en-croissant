import { createEmptyCard } from "ts-fsrs";
import { expect, test } from "vitest";
import { getCardForReview, type Position, type ReviewOrder } from "@/components/files/opening";

const DAY = 24 * 60 * 60 * 1000;

// A card due `dueInDays` from now (negative = overdue). reps === 0 means never practiced.
function position(fen: string, dueInDays: number, reps: number): Position {
    const card = createEmptyCard(new Date(Date.now() + dueInDays * DAY));
    return { fen, answer: "e4", card: { ...card, reps } };
}

// Decks are persisted in localStorage, so card.due is a string by the time we order them.
function deck(...positions: Position[]): Position[] {
    return JSON.parse(JSON.stringify(positions));
}

test("most-overdue serves the most overdue card even when it is not first in the tree", () => {
    const positions = deck(
        position("due-yesterday", -1, 3),
        position("due-5-days-ago", -5, 3),
        position("due-in-2-days", 2, 3),
    );

    expect(getCardForReview(positions, "most-overdue")?.fen).toBe("due-5-days-ago");
    // tree-order keeps the old behavior: first due card in deck order
    expect(getCardForReview(positions, "tree-order")?.fen).toBe("due-yesterday");
});

test("most-overdue reviews practiced cards before unseen ones, whose due date is only when they were added", () => {
    const positions = deck(
        position("unseen-added-30-days-ago", -30, 0),
        position("seen-due-yesterday", -1, 3),
    );

    expect(getCardForReview(positions, "most-overdue")?.fen).toBe("seen-due-yesterday");
    expect(getCardForReview(positions, "tree-order")?.fen).toBe("unseen-added-30-days-ago");
});

test("most-overdue serves unseen cards in tree order, not in the order they were added", () => {
    const positions = deck(
        position("unseen-added-yesterday", -1, 0),
        position("unseen-added-30-days-ago", -30, 0),
    );

    expect(getCardForReview(positions, "most-overdue")?.fen).toBe("unseen-added-yesterday");
});

test("random varies which due card is served and never serves one that isn't due", () => {
    const positions = deck(
        position("due-seen", -1, 2),
        position("not-due-1", 1, 2),
        position("due-unseen", 0, 0),
        position("not-due-2", 3, 2),
    );

    const served = new Set<string | undefined>();
    for (let i = 0; i < 200; i++) {
        served.add(getCardForReview(positions, "random")?.fen);
    }

    expect(served).toEqual(new Set(["due-seen", "due-unseen"]));
});

test("no card is served when nothing is due, whatever the order", () => {
    const positions = deck(position("a", 1, 2), position("b", 2, 3));

    for (const order of ["most-overdue", "random", "tree-order"] as ReviewOrder[]) {
        expect(getCardForReview(positions, order)).toBeNull();
    }
});
