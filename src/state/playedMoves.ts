import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { UnifiedMove } from "@/state/unifiedMoves";

export type PlayedColor = "white" | "black";

export const playedMovesFamily = atomFamily(
  ({ tab, color }: { tab: string; color: PlayedColor }) =>
    atom<(UnifiedMove & { elapsedMs?: number })[]>([]),
  (a, b) => a.tab === b.tab && a.color === b.color,
);


