import type { SetStateAction } from "react";
import { type Card, createEmptyCard, fsrs, type Grade, generatorParameters } from "ts-fsrs";
import { z } from "zod";
import type { PracticeData } from "@/state/atoms";
import { isPrefix } from "@/utils/misc";
import { getNodeAtPath, type TreeNode, treeIterator } from "@/utils/treeReducer";

const params = generatorParameters({ enable_fuzz: true });

const f = fsrs(params);

export const positionSchema = z.object({
    fen: z.string(),
    answer: z.string(),
    card: z.object({}).passthrough(),
});

export type Position = {
    fen: string;
    answer: string;
    card: Card;
};

export function buildFromTree(tree: TreeNode, color: "white" | "black", start: number[]) {
    const cards: Position[] = [];
    const iterator = treeIterator(tree);
    for (const item of iterator) {
        if (item.node.children.length === 0 || isPrefix(item.position, start)) {
            continue;
        }
        if (
            (color === "white" && item.node.halfMoves % 2 === 0) ||
            (color === "black" && item.node.halfMoves % 2 === 1)
        ) {
            // One card per repertoire move, so each of the user's moves here is practiced,
            // however the position is reached
            for (const child of item.node.children) {
                if (
                    child.san &&
                    !cards.find((c) => samePosition(c.fen, item.node.fen) && c.answer === child.san)
                ) {
                    cards.push({
                        fen: item.node.fen,
                        answer: child.san,
                        card: createEmptyCard(),
                    });
                }
            }
        }
    }
    return cards;
}

// The same position reached by different move orders can have a different halfmove
// clock and move number, so only the first four FEN fields identify the position.
export function positionKey(fen: string) {
    return fen.split(" ").slice(0, 4).join(" ");
}

export function samePosition(a: string, b: string) {
    return positionKey(a) === positionKey(b);
}

// The positions where it's the user's move: the ones with a practice card
export function positionsWithCards(positions: Position[]) {
    return new Set(positions.map((position) => positionKey(position.fen)));
}

// Every repertoire move from the position at `path` is a correct answer, including moves
// that follow the same position elsewhere in the tree (transpositions). The node's own
// moves come first, then the rest in tree order; each move is listed once, with the path
// of the existing node it leads to.
export function getAnswers(tree: TreeNode, path: number[]): { san: string; path: number[] }[] {
    const current = getNodeAtPath(tree, path);
    const answers: { san: string; path: number[] }[] = [];
    const addMoves = (node: TreeNode, nodePath: number[]) => {
        node.children.forEach((child, i) => {
            if (child.san && !answers.some((answer) => answer.san === child.san)) {
                answers.push({ san: child.san, path: [...nodePath, i] });
            }
        });
    };
    addMoves(current, path);
    for (const { node, position } of treeIterator(tree)) {
        if (node !== current && samePosition(node.fen, current.fen)) {
            addMoves(node, position);
        }
    }
    return answers;
}

// One of the user's repertoire moves, the same however its position was reached
export function moveKey(fen: string, san: string) {
    return `${positionKey(fen)} ${san}`;
}

// Whether any of the user's moves at or below `node` hasn't been practiced yet. The user's
// positions are the ones with a practice card (`askable`, from `positionsWithCards`).
export function hasMovesLeft(node: TreeNode, practiced: Set<string>, askable: Set<string>) {
    for (const { node: n } of treeIterator(node)) {
        if (
            askable.has(positionKey(n.fen)) &&
            n.children.some((child) => child.san && !practiced.has(moveKey(n.fen, child.san)))
        ) {
            return true;
        }
    }
    return false;
}

// Full practice: whether playing this answer adds nothing — it was already practiced, and so
// was everything after it
export function isAnswerDone(
    tree: TreeNode,
    fen: string,
    answer: { san: string; path: number[] },
    practiced: Set<string>,
    askable: Set<string>,
) {
    return (
        practiced.has(moveKey(fen, answer.san)) &&
        !hasMovesLeft(getNodeAtPath(tree, answer.path), practiced, askable)
    );
}

// How many different moves of the user's there are to practice
export function countMoves(tree: TreeNode, askable: Set<string>) {
    const moves = new Set<string>();
    for (const { node } of treeIterator(tree)) {
        if (askable.has(positionKey(node.fen))) {
            for (const child of node.children) {
                if (child.san) moves.add(moveKey(node.fen, child.san));
            }
        }
    }
    return moves.size;
}

// A move the app plays on the board, or (`jump`) going back to an earlier position
export type PracticeStep = { path: number[]; jump: boolean };

// Full practice walks the repertoire until every one of the user's moves is practiced.
// From the position at `from`, it goes down the line while there's something left, playing
// the opponent's moves; when the line is done it shows the opponent's reply that ends it
// (if `showLastReply`) and goes back to the most recent branch point with something left.
// Returns the steps to play and the position to ask next (null when everything is done).
export function planNextQuestion(
    tree: TreeNode,
    from: number[],
    practiced: Set<string>,
    askable: Set<string>,
    showLastReply: boolean,
): { steps: PracticeStep[]; ask: number[] | null } {
    const movesLeft = (node: TreeNode) => hasMovesLeft(node, practiced, askable);
    const steps: PracticeStep[] = [];
    let path = from;
    let node = getNodeAtPath(tree, path);
    let canShowReply = showLastReply;
    for (;;) {
        while (!(askable.has(positionKey(node.fen)) && movesLeft(node))) {
            const next = node.children.findIndex(movesLeft);
            if (next === -1) {
                break;
            }
            path = [...path, next];
            node = node.children[next];
            steps.push({ path, jump: false });
            canShowReply = false;
        }
        if (askable.has(positionKey(node.fen)) && movesLeft(node)) {
            return { steps, ask: path };
        }
        if (canShowReply && node.children.length > 0) {
            path = [...path, 0];
            steps.push({ path, jump: false });
            canShowReply = false;
        }
        let depth = path.length - 1;
        while (depth >= 0 && !movesLeft(getNodeAtPath(tree, path.slice(0, depth)))) {
            depth--;
        }
        if (depth < 0) {
            return { steps, ask: null };
        }
        path = path.slice(0, depth);
        node = getNodeAtPath(tree, path);
        steps.push({ path, jump: true });
    }
}

function isUsersTurn(node: TreeNode, color: "white" | "black") {
    return (color === "white") === (node.halfMoves % 2 === 0);
}

function hasPositionToPractice(branch: TreeNode, color: "white" | "black") {
    for (const { node } of treeIterator(branch)) {
        if (isUsersTurn(node, color) && node.children.length > 0) {
            return true;
        }
    }
    return false;
}

// "Line N of M" in full practice. The split is the deepest point on the way to `path`
// (not before the Start position) where the repertoire branches: M counts its branches,
// N is this branch's place in the order they were first entered (`visited` holds the
// paths of the positions shown and moves played this session). A branch counts if it's
// one of the user's moves, or the user has something to play further down it.
// Returns null before the first split.
export function getLineProgress(
    tree: TreeNode,
    path: number[],
    visited: number[][],
    color: "white" | "black",
    start: number[],
): { current: number; total: number } | null {
    for (let depth = path.length; depth >= 0; depth--) {
        const splitPath = path.slice(0, depth);
        if (depth < start.length && isPrefix(splitPath, start)) {
            break;
        }
        const split = getNodeAtPath(tree, splitPath);
        const branches = split.children.flatMap((child, i) =>
            isUsersTurn(split, color) || hasPositionToPractice(child, color) ? [i] : [],
        );
        if (branches.length < 2) {
            continue;
        }
        const entered: number[] = [];
        for (const visitedPath of visited) {
            const branch = visitedPath[depth];
            if (
                visitedPath.length > depth &&
                isPrefix(splitPath, visitedPath) &&
                branches.includes(branch) &&
                !entered.includes(branch)
            ) {
                entered.push(branch);
            }
        }
        // At the split itself (the user's choice is next), or not entered yet: the next one
        const index = depth < path.length ? entered.indexOf(path[depth]) : -1;
        return {
            current: index === -1 ? Math.min(entered.length + 1, branches.length) : index + 1,
            total: branches.length,
        };
    }
    return null;
}

type Stats = {
    unseen: number;
    due: number;
    practiced: number;
    nextDue: Date | null;
    total: number;
};

export function getStats(positions: Position[]) {
    const stats: Stats = {
        unseen: 0,
        due: 0,
        practiced: 0,
        nextDue: null,
        total: positions.length,
    };
    const now = new Date();
    for (const card of positions) {
        const dueDate = new Date(card.card.due);
        if (card.card.reps === 0) {
            stats.unseen++;
        } else if (dueDate <= now) {
            stats.due++;
        } else {
            stats.practiced++;
            if (!stats.nextDue || dueDate < stats.nextDue) {
                stats.nextDue = dueDate;
            }
        }
    }
    return stats;
}

export type ReviewOrder = "most-overdue" | "random" | "tree-order";

export function getCardForReview(positions: Position[], order: ReviewOrder): Position | null {
    const now = new Date();

    const filtered = positions.filter((position) => new Date(position.card.due) <= now);

    if (filtered.length === 0) {
        return null;
    }
    if (order === "random") {
        return filtered[Math.floor(Math.random() * filtered.length)];
    }
    if (order === "most-overdue") {
        // An unseen card's due date is just when it was added to the deck, so it isn't
        // overdue: the earliest-due seen card goes first, then unseen cards in tree order.
        const seen = filtered.filter((position) => position.card.reps > 0);
        if (seen.length > 0) {
            return seen.reduce((a, b) => (new Date(b.card.due) < new Date(a.card.due) ? b : a));
        }
    }
    return filtered[0];
}

// Start Practice asks one card: a position and one of the user's moves there. Any of their
// moves is correct and counts for its own card if that card is due. Returns the card to rate
// for `san` (the asked card if it's that move), or null when that move's card isn't due yet.
export function cardForMove(positions: Position[], asked: number, san: string): number | null {
    if (positions[asked].answer === san) {
        return asked;
    }
    const now = new Date();
    const cards = positions.flatMap((p, i) =>
        samePosition(p.fen, positions[asked].fen) && p.answer === san ? [i] : [],
    );
    if (cards.length === 0) {
        return asked;
    }
    return cards.find((i) => new Date(positions[i].card.due) <= now) ?? null;
}

export function updateCardPerformance(
    setPositions: React.Dispatch<SetStateAction<PracticeData>>,
    i: number,
    card: Card,
    grade: 1 | 2 | 3 | 4,
) {
    const schedulingCards = f.repeat(card, new Date());

    const { card: newCard, log } = schedulingCards[grade];

    setPositions((data) => {
        data.positions[i].card = newCard;
        return {
            positions: data.positions,
            // A new list, so the (memoized) logs view sees the new entry
            logs: [
                ...data.logs,
                { ...log, fen: data.positions[i].fen, answer: data.positions[i].answer },
            ],
        };
    });
}

export function syncDeck(
    existing: Position[],
    tree: TreeNode,
    color: "white" | "black",
    start: number[],
): { positions: Position[]; added: number; removed: number } {
    const freshPositions = buildFromTree(tree, color, start);

    // A card is one move at one position (however it's reached); it keeps its progress as
    // long as that move exists
    const cardKey = (pos: Position) => `${positionKey(pos.fen)} ${pos.answer}`;
    const existingByMove = new Map<string, Position>();
    for (const pos of existing) {
        const other = existingByMove.get(cardKey(pos));
        // Older decks can have two cards for one move at a transposition: keep the more practiced
        if (!other || pos.card.reps > other.card.reps) {
            existingByMove.set(cardKey(pos), pos);
        }
    }

    let added = 0;
    const merged: Position[] = [];
    for (const pos of freshPositions) {
        const prev = existingByMove.get(cardKey(pos));
        if (prev) {
            merged.push({ ...prev, fen: pos.fen });
        } else {
            merged.push(pos);
            added++;
        }
    }

    // Cards whose move is gone, or that were merged into another card
    const removed = existing.length - (merged.length - added);

    return { positions: merged, added, removed };
}

export function getNextReviewTimes(card: Card): Record<Grade, Date> {
    const schedulingCards = f.repeat(card, new Date());
    return {
        1: schedulingCards[1].card.due,
        2: schedulingCards[2].card.due,
        3: schedulingCards[3].card.due,
        4: schedulingCards[4].card.due,
    };
}

export function formatReviewInterval(dueDate: Date): string {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const diffHrs = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMin < 1) return "< 1m";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 30) return `${diffDays}d`;
    return `${Math.round(diffDays / 30)}mo`;
}
