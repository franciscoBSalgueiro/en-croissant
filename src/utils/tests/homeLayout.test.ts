import { expect, test } from "vitest";
import {
    addHomeCard,
    addHomeList,
    cardDropIndices,
    DEFAULT_HOME_LAYOUT,
    type HomeLayout,
    type HomeSize,
    homeCardGrid,
    homeLayoutFits,
    homeListMoveAllowed,
    homePanelId,
    picksThatFit,
    moveHomeCard,
    moveHomeList,
    normalizeHomeLayout,
    removeHomePanel,
    togglePick,
} from "../homeLayout";

const card = (id: string) => ({ id, kind: "playChess" as const });
const list = (id: string) => ({ id, kind: "recentFiles" as const });
const ids = (layout: HomeLayout) => ({
    cards: layout.cards.map((c) => c.id),
    columns: layout.columns.map((column) => column.map((l) => l.id)),
});

// Room for 3 columns side by side. Under one row of cards, 2 lists stack in a column; under two
// rows, only 1; with no cards, 3.
const size: HomeSize = {
    width: 1000,
    height: 800,
    cardsPerRow: 5,
    cardSize: 250,
    gap: 16,
    minListWidth: 320,
    minListHeight: 190,
};
const fiveCards = ["1", "2", "3", "4", "5"].map(card);

test("the default home screen has the five cards from before it could be customized, then Recent files", () => {
    expect(ids(DEFAULT_HOME_LAYOUT)).toEqual({
        cards: ["playChess", "analysisBoard", "newRepertoire", "importGame", "puzzles"],
        columns: [["recentFiles"]],
    });
    expect(DEFAULT_HOME_LAYOUT.collapsed).toEqual([]);
});

test("a layout saved by another version keeps what this version knows, in its order", () => {
    const saved = {
        cards: [
            { id: "puzzles", kind: "puzzles" },
            { id: "fromNewerVersion", kind: "somethingNew" },
            { id: "playChess", kind: "playChess" },
            { id: "playChess", kind: "playChess" },
            { id: "misplaced", kind: "recentFiles" },
        ],
        columns: [
            [{ id: "gone", kind: "somethingNew" }],
            [{ id: "recentFiles", kind: "recentFiles" }],
        ],
        collapsed: ["gone", "recentFiles"],
    };
    const layout = normalizeHomeLayout(saved);
    expect(ids(layout)).toEqual({ cards: ["puzzles", "playChess"], columns: [["recentFiles"]] });
    expect(layout.collapsed).toEqual(["recentFiles"]);
});

test("an unreadable saved layout gives the default one rather than an empty home screen", () => {
    expect(normalizeHomeLayout("not a layout")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout({ cards: [] })).toEqual(DEFAULT_HOME_LAYOUT);
});

test("a new list opens a new column while one fits, then goes under the rightmost column", () => {
    let layout: HomeLayout = {
        cards: fiveCards,
        columns: [[list("a")], [list("b")]],
        collapsed: [],
    };
    layout = addHomeList(layout, list("c"), size)!;
    expect(ids(layout).columns).toEqual([["a"], ["b"], ["c"]]);
    layout = addHomeList(layout, list("d"), size)!;
    expect(ids(layout).columns).toEqual([["a"], ["b"], ["c", "d"]]);
    // The rightmost column is full and a 4th column doesn't fit, even though column "a" has room
    expect(addHomeList(layout, list("e"), size)).toBeNull();
});

test("a card that starts a new row needs the lists to keep their minimum height below it", () => {
    const twoStacked: HomeLayout = {
        cards: fiveCards,
        columns: [[list("a"), list("b")]],
        collapsed: [],
    };
    expect(addHomeCard(twoStacked, card("6"), size)).toBeNull();
    // Collapsed lists count as expanded, so expanding one later never runs out of room
    expect(addHomeCard({ ...twoStacked, collapsed: ["a", "b"] }, card("6"), size)).toBeNull();
    // One list in the column still fits under two rows of cards
    expect(addHomeCard({ ...twoStacked, columns: [[list("a")]] }, card("6"), size)).not.toBeNull();
    // With no lists, the cards can take the whole screen
    expect(addHomeCard({ ...twoStacked, columns: [] }, card("6"), size)).not.toBeNull();
    // A card that fills the current row doesn't take any height from the lists
    expect(
        addHomeCard({ ...twoStacked, cards: fiveCards.slice(0, 4) }, card("5"), size),
    ).not.toBeNull();
});

test("a dragged list can't overfill a column, but can still be rearranged once the window is too small", () => {
    const layout: HomeLayout = {
        cards: fiveCards,
        columns: [[list("a")], [list("b"), list("c")]],
        collapsed: [],
    };
    const intoFullColumn = moveHomeList(layout, { column: 0, index: 0 }, { column: 1, index: 2 });
    expect(homeListMoveAllowed(layout, intoFullColumn, size)).toBe(false);
    const intoNewColumn = moveHomeList(layout, { column: 1, index: 1 }, { newColumn: 0 });
    expect(ids(intoNewColumn).columns).toEqual([["c"], ["a"], ["b"]]);
    expect(homeListMoveAllowed(layout, intoNewColumn, size)).toBe(true);

    // A window so short no list fits any more: swapping two lists doesn't need more room
    const short = { ...size, height: 400 };
    const swapped = moveHomeList(layout, { column: 1, index: 0 }, { column: 1, index: 1 });
    expect(ids(swapped).columns).toEqual([["a"], ["c", "b"]]);
    expect(homeListMoveAllowed(layout, swapped, short)).toBe(true);
    expect(homeListMoveAllowed(layout, intoFullColumn, short)).toBe(false);
});

test("dropping a list between two columns makes a new column there, and its old column goes away", () => {
    const layout: HomeLayout = {
        cards: [],
        columns: [[list("a")], [list("b")], [list("c")]],
        collapsed: [],
    };
    const moved = moveHomeList(layout, { column: 0, index: 0 }, { newColumn: 2 });
    expect(ids(moved).columns).toEqual([["b"], ["a"], ["c"]]);
});

test("a card dropped in front of another card lands right before it, whichever row it came from", () => {
    const layout: HomeLayout = {
        cards: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(card),
        columns: [],
        collapsed: [],
    };
    const drop = (source: [number, number], destination: [number, number]) => {
        const { from, to } = cardDropIndices(
            { row: source[0], index: source[1] },
            { row: destination[0], index: destination[1] },
            5,
        );
        return ids(moveHomeCard(layout, from, to)).cards.join("");
    };
    // Card 1 dropped in front of card 7 (third in the second row)
    expect(drop([0, 1], [1, 2])).toBe("0234561789");
    // Card 8 dropped in front of card 0
    expect(drop([1, 3], [0, 0])).toBe("8012345679");
    // Within a row: card 0 moved to fourth place
    expect(drop([0, 0], [0, 3])).toBe("1230456789");
});

test("removing a column's only list removes the column and forgets that it was collapsed", () => {
    const layout: HomeLayout = { cards: [], columns: [[list("a")], [list("b")]], collapsed: ["a"] };
    const removed = removeHomePanel(layout, "a");
    expect(ids(removed).columns).toEqual([["b"]]);
    expect(removed.collapsed).toEqual([]);
});

test("a saved panel that shows one thing keeps it; one that lost it is dropped, not shown empty", () => {
    const layout = normalizeHomeLayout({
        cards: [
            { id: "account:lichess:a", kind: "account", target: "lichess:a" },
            { id: "account:", kind: "account" },
        ],
        columns: [[{ id: "folder:/games", kind: "folder", target: "/games" }]],
        collapsed: [],
    });
    expect(layout.cards).toEqual([
        { id: "account:lichess:a", kind: "account", target: "lichess:a" },
    ]);
    expect(layout.columns).toEqual([[{ id: "folder:/games", kind: "folder", target: "/games" }]]);
});

test("the same account can't be shown on two account cards, but two picks cards can both be added", () => {
    const sameAccount = homePanelId("account", "lichess:a");
    expect(homePanelId("account", "lichess:a")).toBe(sameAccount);
    expect(homePanelId("account", "chesscom:a")).not.toBe(sameAccount);
    expect(homePanelId("accountPicks")).not.toBe(homePanelId("accountPicks"));
    const layout = normalizeHomeLayout({
        cards: [
            { id: sameAccount, kind: "account", target: "lichess:a" },
            { id: sameAccount, kind: "account", target: "lichess:a" },
        ],
        columns: [],
        collapsed: [],
    });
    expect(layout.cards).toHaveLength(1);
});

test("a picks card picked on a bigger screen keeps everything it shows, but never the same thing twice", () => {
    const picked = ["a", "b", "a", "c", "d", "e", "f", "g", "h"];
    const layout = normalizeHomeLayout({
        cards: [{ id: "filePicks:1", kind: "filePicks", items: picked }],
        columns: [],
        collapsed: [],
    });
    // On a smaller window its rows scroll; nothing is dropped
    expect(layout.cards[0].items).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);

    const full = ["a", "b", "c", "d"];
    expect(togglePick(full, "x", 4)).toEqual(full);
    // Unpicking one keeps the others in the order they were picked, and makes room again
    expect(togglePick(full, "b", 4)).toEqual(["a", "c", "d"]);
    expect(togglePick(["a", "c", "d"], "x", 4)).toEqual(["a", "c", "d", "x"]);
});

test("a picks card can be given as many things as its rows fit, at least one", () => {
    // Its padding and title (60), then rows of 30 with a gap of 2 above each but the first
    expect(picksThatFit(60 + 6 * 30 + 5 * 2, 60, 30, 2)).toBe(6);
    expect(picksThatFit(60 + 6 * 30 + 5 * 2 - 1, 60, 30, 2)).toBe(5);
    // A bigger card (a wider window) holds more
    expect(picksThatFit(400, 60, 30, 2)).toBeGreaterThan(picksThatFit(250, 60, 30, 2));
    expect(picksThatFit(50, 60, 30, 2)).toBe(1);
});

test("cards fill their row five at a time down to their smallest size, then fewer and larger", () => {
    // Five cards of exactly the smallest size, and the gaps between them
    expect(homeCardGrid(5 * 216 + 4 * 16, 16, 216)).toEqual({ cardsPerRow: 5, cardSize: 216 });
    // A pixel narrower, five would be too small: four, each larger than the smallest
    const narrower = homeCardGrid(5 * 216 + 4 * 16 - 1, 16, 216);
    expect(narrower.cardsPerRow).toBe(4);
    expect(narrower.cardSize).toBeGreaterThan(216);
    // However wide the window, still five to a row, growing with it
    const wide = homeCardGrid(3000, 16, 216);
    expect(wide.cardsPerRow).toBe(5);
    expect(wide.cardSize * 5 + 4 * 16).toBe(3000);
    // Too narrow for even one at the smallest size: one, as wide as there is room for
    expect(homeCardGrid(150, 16, 216)).toEqual({ cardsPerRow: 1, cardSize: 150 });
});

test("the gap between the cards and the lists comes out of the lists' room", () => {
    const twoStacked: HomeLayout = {
        cards: fiveCards,
        columns: [[list("a"), list("b")]],
        collapsed: [],
    };
    // Two stacked lists need 2 × 190 + 16 = 396 below the cards (250) and the gap above them (16)
    expect(homeLayoutFits(twoStacked, { ...size, height: 250 + 16 + 396 })).toBe(true);
    // Room for them only if that gap were left out
    expect(homeLayoutFits(twoStacked, { ...size, height: 250 + 396 })).toBe(false);
});
