import { z } from "zod";

// The home screen (a new tab) is a row of cards above columns of lists. Users can reorder, remove
// and add both; the layout is saved, and each list can be collapsed to its title bar.

export const HOME_CARD_KINDS = [
    "playChess",
    "analysisBoard",
    "newRepertoire",
    "importGame",
    "puzzles",
    "boardEditor",
    "account",
    "accountPicks",
    "database",
    "databasePicks",
    "file",
    "filePicks",
] as const;
export const HOME_LIST_KINDS = [
    "recentFiles",
    "accounts",
    "databases",
    "databaseGames",
    "folder",
    "fileType",
] as const;

export type HomeCardKind = (typeof HOME_CARD_KINDS)[number];
export type HomeListKind = (typeof HOME_LIST_KINDS)[number];
export type HomePanelKind = HomeCardKind | HomeListKind;

// Kinds that show one particular thing, its target (an account, a database, a file, a folder or a
// file type): one panel per target
const TARGETED_KINDS: HomePanelKind[] = [
    "account",
    "database",
    "file",
    "databaseGames",
    "folder",
    "fileType",
];
// Cards that show a few things the user picks, as rows; any number of them
const PICKS_KINDS: HomePanelKind[] = ["accountPicks", "databasePicks", "filePicks"];
// How many things a picks card can be given: as many rows as fit it at its current size (less its
// padding and title), each with the gap above it, and at least one. On a smaller window later, its
// rows scroll.
export function picksThatFit(cardSize: number, chrome: number, rowHeight: number, gap: number) {
    return Math.max(1, Math.floor((cardSize - chrome + gap) / (rowHeight + gap)));
}

export function isTargetedKind(kind: HomePanelKind) {
    return TARGETED_KINDS.includes(kind);
}

export function isPicksKind(kind: HomePanelKind) {
    return PICKS_KINDS.includes(kind);
}

export type HomePanel<Kind extends string> = {
    id: string;
    kind: Kind;
    // For a targeted kind: what it shows
    target?: string;
    // For a picks kind: what it shows, in order
    items?: string[];
};

// A targeted panel's id says what it shows, so the same thing can't be added twice; a picks card's
// is new each time
export function homePanelId(kind: HomePanelKind, target?: string) {
    if (isTargetedKind(kind)) return `${kind}:${target}`;
    if (isPicksKind(kind)) return `${kind}:${crypto.randomUUID()}`;
    return kind;
}

export type HomeLayout = {
    cards: HomePanel<HomeCardKind>[];
    // Left to right; each column is its lists from top to bottom
    columns: HomePanel<HomeListKind>[][];
    // Ids of the collapsed lists
    collapsed: string[];
};

// The home screen before it could be customized
export const DEFAULT_HOME_LAYOUT: HomeLayout = {
    cards: (["playChess", "analysisBoard", "newRepertoire", "importGame", "puzzles"] as const).map(
        (kind) => ({ id: kind, kind }),
    ),
    columns: [[{ id: "recentFiles", kind: "recentFiles" }]],
    collapsed: [],
};

const panelSchema = z.object({
    id: z.string(),
    kind: z.string(),
    target: z.string().optional(),
    items: z.array(z.string()).optional(),
});
const layoutSchema = z.object({
    cards: z.array(panelSchema),
    columns: z.array(z.array(panelSchema)),
    collapsed: z.array(z.string()),
});

// A saved layout can come from another version of the app: panels it doesn't know (or that are in
// the wrong place, repeated, or missing what they show) are dropped, so the rest still shows;
// anything unreadable gives the default layout
export function normalizeHomeLayout(saved: unknown): HomeLayout {
    const parsed = layoutSchema.safeParse(saved);
    if (!parsed.success) {
        return DEFAULT_HOME_LAYOUT;
    }
    const seen = new Set<string>();
    function keep<Kind extends HomePanelKind>(
        panels: z.infer<typeof panelSchema>[],
        kinds: readonly Kind[],
    ) {
        const kept: HomePanel<Kind>[] = [];
        for (const { id, kind, target, items } of panels) {
            if (seen.has(id) || !kinds.includes(kind as Kind)) continue;
            const panel: HomePanel<Kind> = { id, kind: kind as Kind };
            if (isTargetedKind(panel.kind)) {
                if (target === undefined) continue;
                panel.target = target;
            }
            if (isPicksKind(panel.kind)) {
                panel.items = [...new Set(items ?? [])];
            }
            seen.add(id);
            kept.push(panel);
        }
        return kept;
    }
    const cards = keep(parsed.data.cards, HOME_CARD_KINDS);
    const columns = parsed.data.columns
        .map((column) => keep(column, HOME_LIST_KINDS))
        .filter((column) => column.length > 0);
    const listIds = new Set(columns.flat().map((panel) => panel.id));
    const collapsed = parsed.data.collapsed.filter((id) => listIds.has(id));
    return { cards, columns, collapsed };
}

// Every panel on the home screen, cards first
export function homePanels(layout: HomeLayout): HomePanel<HomePanelKind>[] {
    return [...layout.cards, ...layout.columns.flat()];
}

// What a picks card shows after a click on one of the things it can show: picked last if it wasn't
// picked (unless it already has the most it can show), left out if it was
export function togglePick(items: string[], item: string, max: number): string[] {
    if (items.includes(item)) return items.filter((picked) => picked !== item);
    return items.length < max ? [...items, item] : items;
}

export function setHomePicks(layout: HomeLayout, id: string, items: string[]): HomeLayout {
    return {
        ...layout,
        cards: layout.cards.map((card) => (card.id === id ? { ...card, items } : card)),
    };
}

// As many cards to a row as before the home screen could be customized
const CARDS_PER_ROW = 5;

// The cards are square, from their smallest size to their largest. Five to a row share its width;
// a window wide enough for five at their largest fits as many as it can at that size rather than
// making them bigger, and a narrower one fits fewer (never bigger than their largest either)
export function homeCardGrid(width: number, gap: number, minCardSize: number, maxCardSize: number) {
    const atLargest = Math.floor((width + gap) / (maxCardSize + gap));
    if (atLargest >= CARDS_PER_ROW) {
        return { cardsPerRow: atLargest, cardSize: maxCardSize };
    }
    const cardsPerRow = Math.max(
        1,
        Math.min(CARDS_PER_ROW, Math.floor((width + gap) / (minCardSize + gap))),
    );
    return {
        cardsPerRow,
        cardSize: Math.min(maxCardSize, (width - (cardsPerRow - 1) * gap) / cardsPerRow),
    };
}

// What the home screen has room for, in CSS pixels
export type HomeSize = {
    width: number;
    height: number;
    cardsPerRow: number;
    // A card's width and height
    cardSize: number;
    // Every gap: between cards, between the cards and the lists, between columns, and between the
    // lists in a column
    gap: number;
    // The smallest a list can be and still show its rows readably
    minListWidth: number;
    minListHeight: number;
};

function cardsHeight(count: number, size: HomeSize) {
    const rows = Math.ceil(count / size.cardsPerRow);
    return rows === 0 ? 0 : rows * size.cardSize + (rows - 1) * size.gap;
}

function tallestColumn(layout: HomeLayout) {
    return Math.max(0, ...layout.columns.map((column) => column.length));
}

// Whether every list gets at least its minimum size below the cards. A collapsed list counts as
// expanded, so expanding it never runs out of room. Without lists, the cards just have to fit.
export function homeLayoutFits(layout: HomeLayout, size: HomeSize): boolean {
    const cards = cardsHeight(layout.cards.length, size);
    if (layout.columns.length === 0) {
        return cards <= size.height;
    }
    const listsHeight = size.height - cards - (layout.cards.length > 0 ? size.gap : 0);
    const maxColumns = Math.floor((size.width + size.gap) / (size.minListWidth + size.gap));
    const maxStacked = Math.floor((listsHeight + size.gap) / (size.minListHeight + size.gap));
    return layout.columns.length <= maxColumns && tallestColumn(layout) <= maxStacked;
}

// A new card goes at the end; null when there's no room for it
export function addHomeCard(
    layout: HomeLayout,
    card: HomePanel<HomeCardKind>,
    size: HomeSize,
): HomeLayout | null {
    const next = { ...layout, cards: [...layout.cards, card] };
    return homeLayoutFits(next, size) ? next : null;
}

// A new list goes in a new column on the right, or at the bottom of the rightmost column when
// another column doesn't fit; null when neither has room
export function addHomeList(
    layout: HomeLayout,
    list: HomePanel<HomeListKind>,
    size: HomeSize,
): HomeLayout | null {
    const newColumn = { ...layout, columns: [...layout.columns, [list]] };
    if (homeLayoutFits(newColumn, size)) {
        return newColumn;
    }
    const last = layout.columns.length - 1;
    if (last < 0) {
        return null;
    }
    const stacked = {
        ...layout,
        columns: layout.columns.map((column, i) => (i === last ? [...column, list] : column)),
    };
    return homeLayoutFits(stacked, size) ? stacked : null;
}

export function removeHomePanel(layout: HomeLayout, id: string): HomeLayout {
    return {
        cards: layout.cards.filter((card) => card.id !== id),
        columns: layout.columns
            .map((column) => column.filter((list) => list.id !== id))
            .filter((column) => column.length > 0),
        collapsed: layout.collapsed.filter((collapsedId) => collapsedId !== id),
    };
}

export function toggleHomeListCollapsed(layout: HomeLayout, id: string): HomeLayout {
    return {
        ...layout,
        collapsed: layout.collapsed.includes(id)
            ? layout.collapsed.filter((collapsedId) => collapsedId !== id)
            : [...layout.collapsed, id],
    };
}

// The cards are laid out in rows, each its own drop area. A drop's position in a row becomes an
// index in the single list of cards (after the dragged card is taken out of it).
export function cardDropIndices(
    source: { row: number; index: number },
    destination: { row: number; index: number },
    perRow: number,
): { from: number; to: number } {
    const from = source.row * perRow + source.index;
    // Taking the card out moves every later card back by one
    const rowStart =
        destination.row > source.row ? destination.row * perRow - 1 : destination.row * perRow;
    return { from, to: rowStart + destination.index };
}

export function moveHomeCard(layout: HomeLayout, from: number, to: number): HomeLayout {
    const cards = [...layout.cards];
    const [card] = cards.splice(from, 1);
    cards.splice(to, 0, card);
    return { ...layout, cards };
}

// Where a dragged list is dropped: at a position in a column, or into the gap before the column
// with that index (the number of columns for the far right), which makes a new column there
export type HomeListDestination = { column: number; index: number } | { newColumn: number };

export function moveHomeList(
    layout: HomeLayout,
    source: { column: number; index: number },
    destination: HomeListDestination,
): HomeLayout {
    const columns = layout.columns.map((column) => [...column]);
    const [list] = columns[source.column].splice(source.index, 1);
    if ("newColumn" in destination) {
        columns.splice(destination.newColumn, 0, [list]);
    } else {
        columns[destination.column].splice(destination.index, 0, list);
    }
    return { ...layout, columns: columns.filter((column) => column.length > 0) };
}

// A move that leaves room for every list is fine. So is one that doesn't need more room than
// before, so lists can still be rearranged after the window got too small for them.
export function homeListMoveAllowed(
    before: HomeLayout,
    after: HomeLayout,
    size: HomeSize,
): boolean {
    return (
        homeLayoutFits(after, size) ||
        (after.columns.length <= before.columns.length &&
            tallestColumn(after) <= tallestColumn(before))
    );
}
