import { Chess, Move, SQUARES } from "chess.ts";
import { Key } from "chessground/types";

export function moveToKey(move: Move | undefined) {
  return move ? ([move.from, move.to] as Key[]) : undefined;
}

export function toDests(chess: Chess): Map<Key, Key[]> {
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

export function getLastMove(chess: Chess) {
  return chess.history({ verbose: true }).pop();
}