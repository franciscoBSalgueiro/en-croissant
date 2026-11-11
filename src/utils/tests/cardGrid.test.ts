import { expect, test } from "vitest";
import { cardGrid } from "../cardGrid";

// The User page's account cards: 18rem to 21rem wide, 1rem apart, two to a row (a player's Lichess
// and Chess.com cards side by side), at a 16px font
const grid = (width: number) => cardGrid(width, 16, 288, 336, 2);

test("with room for two at their largest, a player's two accounts sit side by side at that size", () => {
    expect(grid(2 * 336 + 16)).toEqual({ cardsPerRow: 2, cardSize: 336 });
});

test("a narrower page shrinks both cards, keeping them side by side, until they reach their smallest", () => {
    // Between two at their smallest and two at their largest
    expect(grid(640)).toEqual({ cardsPerRow: 2, cardSize: (640 - 16) / 2 });
    expect(grid(2 * 288 + 16)).toEqual({ cardsPerRow: 2, cardSize: 288 });
});

test("a page too narrow for two at their smallest has one card to a row, never bigger than the largest", () => {
    expect(grid(2 * 288 + 16 - 1)).toEqual({ cardsPerRow: 1, cardSize: 336 });
    expect(grid(300)).toEqual({ cardsPerRow: 1, cardSize: 300 });
});

test("two cards at their largest aren't shrunk to fit a third, since a player has two accounts at most", () => {
    // Room for three at their smallest, but only two at their largest
    expect(grid(3 * 288 + 2 * 16)).toEqual({ cardsPerRow: 2, cardSize: 336 });
});

test("a wide page fits more cards at their largest rather than making them bigger", () => {
    expect(grid(3 * 336 + 2 * 16)).toEqual({ cardsPerRow: 3, cardSize: 336 });
    expect(grid(2000).cardSize).toBe(336);
});

test("every card in a row is the same size and the row fits the page", () => {
    for (const width of [300, 500, 600, 640, 688, 700, 1100, 2000]) {
        const { cardsPerRow, cardSize } = grid(width);
        expect(cardsPerRow * cardSize + (cardsPerRow - 1) * 16).toBeLessThanOrEqual(width);
    }
});
