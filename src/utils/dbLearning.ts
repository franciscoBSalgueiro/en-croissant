import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { type Card, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import { z } from "zod";
import { commands, type GameQuery, type OpeningMoveReport } from "@/bindings";
import { createZodStorage } from "@/state/utils";
import { positionFromFen } from "@/utils/chessops";

// ---------------------------------------------------------------------------
// Model games (players that played the current position the most)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Similar games (same pawn skeleton, mirror-tolerant)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Strategy trainer deck (ts-fsrs, mirrors src/components/files/opening.ts)
// ---------------------------------------------------------------------------

const params = generatorParameters({ enable_fuzz: true });
const f = fsrs(params);

export type StrategyCard = {
    fen: string;
    /** Accepted SAN answers for this position, most popular first. */
    answers: string[];
    card: Card;
};

/**
 * Stored deck item. Older versions stored a single `answer`; loading migrates
 * those records to the multi-answer shape used by the trainer.
 */
const strategyDeckSchema = z.object({
    fen: z.string(),
    answer: z.string().optional(),
    answers: z.array(z.string()).optional(),
    card: z.any(),
});

type StoredStrategyCard = z.infer<typeof strategyDeckSchema>;

const deckStorage = createZodStorage(strategyDeckSchema.array(), localStorage);

function fenRoot4(fen: string): string {
    return fen.split(" ").slice(0, 4).join(" ");
}

export function strategyDeckKey(path: string, rootFen: string): string {
    return `strategy-deck-${path}-${fenRoot4(rootFen)}`;
}

function normalizeDeckItem(stored: StoredStrategyCard): StrategyCard {
    return {
        fen: stored.fen,
        answers: stored.answers ?? (stored.answer ? [stored.answer] : []),
        card: stored.card as Card,
    };
}

export function loadStrategyDeck(key: string): StrategyCard[] {
    try {
        const stored = deckStorage.getItem(key, []);
        const normalized = stored.map(normalizeDeckItem);
        if (stored.some((item) => item.answers === undefined)) {
            saveStrategyDeck(key, normalized);
        }
        return normalized;
    } catch {
        return [];
    }
}

export function saveStrategyDeck(key: string, deck: StrategyCard[]): void {
    deckStorage.setItem(
        key,
        deck.map(({ fen, answers, card }) => ({ fen, answers, card })),
    );
}

export function gradeCard(card: Card, grade: 1 | 2 | 3 | 4): Card {
    const schedulingCards = f.repeat(card, new Date());
    return schedulingCards[grade].card;
}

export type StrategyStats = {
    total: number;
    unseen: number;
    due: number;
    practiced: number;
};

export function strategyStats(deck: StrategyCard[]): StrategyStats {
    const stats: StrategyStats = { total: deck.length, unseen: 0, due: 0, practiced: 0 };
    const now = new Date();
    for (const { card } of deck) {
        const dueDate = new Date(card.due);
        if (card.reps === 0) {
            stats.unseen++;
        } else if (dueDate <= now) {
            stats.due++;
        } else {
            stats.practiced++;
        }
    }
    return stats;
}

/** Order the deck so that due cards (including new cards) come first. */
export function orderStrategyDeck(deck: StrategyCard[]): StrategyCard[] {
    const now = new Date();
    const due = deck.filter((c) => new Date(c.card.due) <= now);
    const rest = deck.filter((c) => new Date(c.card.due) > now);
    return [...due, ...rest];
}

// ---------------------------------------------------------------------------
// Deck building from opening report chains
// ---------------------------------------------------------------------------

/** Number of moves considered at the root position. */
const ROOT_MOVES = 3;
/** Maximum plies from the root position (root move counts as depth 1). */
const MAX_DEPTH = 5;
/** Upper bound of openingReport calls (root + follow-ups). */
const MAX_REPORT_CALLS = 8;

/** Play a SAN move on a FEN and return the resulting FEN (null if illegal). */
export function playSan(fen: string, san: string): string | null {
    const [pos] = positionFromFen(fen);
    if (!pos) return null;
    const move = parseSan(pos, san);
    if (!move) return null;
    pos.play(move);
    return makeFen(pos.toSetup());
}

function exactQuery(fen: string): GameQuery {
    return { position: { fen, type_: "exact" } };
}

function topMoves(report: OpeningMoveReport[]): OpeningMoveReport[] {
    return report.filter((m) => m.move_ !== "*" && m.total > 0).sort((a, b) => b.total - a.total);
}

/**
 * Adds `answer` to the card for `fen`, creating the card when needed.
 * Multiple answers are kept (most popular first) so a position can accept
 * several good moves, e.g. the top-3 root moves.
 */
export function addDeckAnswer(deck: Map<string, StrategyCard>, fen: string, answer: string): void {
    const existing = deck.get(fen);
    if (existing) {
        if (!existing.answers.includes(answer)) {
            existing.answers.push(answer);
        }
        return;
    }
    deck.set(fen, { fen, answers: [answer], card: createEmptyCard() });
}

/**
 * Build a quiz deck from `openingReport` chains:
 * - at the root, accept the top 3 moves by total games as answers,
 * - follow each of those branches with the TOP move only, up to `MAX_DEPTH`,
 * - each item is the position BEFORE the move plus its accepted answer SANs,
 * - cards are deduplicated by FEN; multiple answers for one position merge.
 * Stops early when a report call errors or returns no moves.
 */
export async function buildStrategyDeck(path: string, rootFen: string): Promise<StrategyCard[]> {
    const deck = new Map<string, StrategyCard>();
    let calls = 0;
    let errored = false;

    async function report(fen: string): Promise<OpeningMoveReport[] | null> {
        if (calls >= MAX_REPORT_CALLS) return null;
        calls++;
        const res = await commands.openingReport(path, exactQuery(fen));
        if (res.status === "error") {
            errored = true;
            return null;
        }
        return res.data;
    }

    const rootReport = await report(rootFen);
    if (!rootReport) return [];

    const queue: { fen: string; depth: number }[] = [];
    for (const move of topMoves(rootReport).slice(0, ROOT_MOVES)) {
        addDeckAnswer(deck, rootFen, move.move_);
        const child = playSan(rootFen, move.move_);
        if (child) queue.push({ fen: child, depth: 1 });
    }

    while (queue.length > 0 && !errored && calls < MAX_REPORT_CALLS) {
        const next = queue.shift()!;
        if (next.depth >= MAX_DEPTH) continue;
        const rep = await report(next.fen);
        if (!rep) continue;
        const top = topMoves(rep)[0];
        if (!top) continue;
        addDeckAnswer(deck, next.fen, top.move_);
        const child = playSan(next.fen, top.move_);
        if (child) queue.push({ fen: child, depth: next.depth + 1 });
    }

    return [...deck.values()];
}
