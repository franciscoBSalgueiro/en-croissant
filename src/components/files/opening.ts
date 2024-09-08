import type { PracticeData } from "@/state/atoms";
import { isPrefix } from "@/utils/misc";
import { type TreeNode, treeIterator } from "@/utils/treeReducer";
import type { SetStateAction } from "react";
import { type Card, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import { z } from "zod";

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

export function buildFromTree(
  tree: TreeNode,
  color: "white" | "black",
  start: number[],
) {
  const cards: Position[] = [];
  const iterator = treeIterator(tree);
  for (const item of iterator) {
    if (
      item.node.children.length === 0 ||
      isPrefix(item.position, start) ||
      !item.node.children[0].san ||
      cards.find((c) => c.fen === item.node.fen)
    ) {
      continue;
    }
    if (
      (color === "white" && item.node.halfMoves % 2 === 0) ||
      (color === "black" && item.node.halfMoves % 2 === 1)
    ) {
      cards.push({
        fen: item.node.fen,
        answer: item.node.children[0].san,
        card: createEmptyCard(),
      });
    }
  }
  return cards;
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
  for (const card of positions) {
    if (card.card.reps === 0) {
      stats.unseen++;
    } else if (card.card.due < new Date()) {
      stats.due++;
    } else {
      stats.practiced++;
    }
    if (!stats.nextDue || card.card.due < stats.nextDue) {
      stats.nextDue = card.card.due;
    }
  }
  return stats;
}

export function getCardForReview(
  positions: Position[],
  options: { random: boolean } = { random: false },
): Position | null {
  if (options.random) {
    return positions[Math.floor(Math.random() * positions.length)];
  }
  const now = new Date();

  const filtered = positions.filter(
    (position) => new Date(position.card.due) <= now,
  );

  return filtered.length > 0 ? filtered[0] : null;
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
    data.logs.push({ ...log, fen: data.positions[i].fen });
    return {
      positions: data.positions,
      logs: data.logs,
    };
  });
}
