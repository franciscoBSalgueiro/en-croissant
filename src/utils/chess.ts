import { Move, SQUARES } from "chess.ts";
import { Key } from "chessground/types";

export function moveToKey(move: Move): Key[] {
  return move ? ([move.from, move.to] as Key[]) : null;
}

export function toDests(chess): Map<Key, Key[]> {
  const dests = new Map();
  Object.keys(SQUARES).forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length)
      dests.set(
        s,
        ms.map((m) => m.to)
      );
  });
  return dests;
}

export function formatMove(orientation: string) {
  return orientation === "w" ? "white" : "black";
}
