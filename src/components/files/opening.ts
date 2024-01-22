import { isPrefix } from "@/utils/misc";
import { TreeNode, treeIterator } from "@/utils/treeReducer";
import { SetStateAction } from "react";
import { match } from "ts-pattern";

type Level = "unseen" | "learning" | "reviewing" | "mastered";

export type Card = {
  fen: string;
  position: number[];
  answer: string;
  repetitions: number;
  level: Level;
};

export function buildFromTree(
  tree: TreeNode,
  color: "white" | "black",
  start: number[],
) {
  const cards: Card[] = [];
  const iterator = treeIterator(tree);
  for (const item of iterator) {
    if (
      item.node.children.length === 0 ||
      isPrefix(item.position, start) ||
      !item.node.children[0].move
    ) {
      continue;
    }
    if (
      (color === "white" && item.node.halfMoves % 2 === 0) ||
      (color === "black" && item.node.halfMoves % 2 === 1)
    ) {
      cards.push({
        fen: item.node.fen,
        position: item.position,
        answer: item.node.children[0].move?.san,
        repetitions: 0,
        level: "unseen",
      });
    }
  }
  return cards;
}

export function getStats(cards: Card[]) {
  const stats = {
    unseen: 0,
    learning: 0,
    reviewing: 0,
    mastered: 0,
    due: 0,
    total: cards.length,
  };
  for (const card of cards) {
    stats[card.level]++;
  }
  stats.due = stats.learning + stats.reviewing + stats.unseen;
  return stats;
}

export function getCardForReview(
  cards: Card[],
  options: { random: boolean } = { random: false },
): Card | null {
  if (options.random) {
    return cards[Math.floor(Math.random() * cards.length)];
  }

  const unseen = cards.filter((card) => card.level === "unseen");
  if (unseen.length > 0) {
    return unseen[0];
  }
  const learning = cards.filter((card) => card.level === "learning");
  if (learning.length > 0) {
    return learning[0];
  }
  const reviewing = cards.filter((card) => card.level === "reviewing");
  if (reviewing.length > 0) {
    return reviewing[0];
  }
  const mastered = cards.filter((card) => card.level === "mastered");
  if (mastered.length > 0) {
    return mastered[0];
  }

  return null;
}

export function updateCardPerformance(
  setCards: React.Dispatch<SetStateAction<Card[]>>,
  i: number,
  isRecalled: boolean,
) {
  setCards((cards) => {
    const newCards = [...cards];
    const card = newCards[i];
    if (isRecalled) {
      card.level = match(card.level)
        .with("unseen", () => "learning" as const)
        .with("learning", () => "reviewing" as const)
        .with("reviewing", () => "mastered" as const)
        .with("mastered", () => "mastered" as const)
        .exhaustive();
    } else {
      card.level = match(card.level)
        .with("unseen", () => "unseen" as const)
        .with("learning", () => "unseen" as const)
        .with("reviewing", () => "learning" as const)
        .with("mastered", () => "reviewing" as const)
        .exhaustive();
    }
    card.repetitions++;
    return newCards;
  });
}
