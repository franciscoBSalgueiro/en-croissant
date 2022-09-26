// import { SQUARES } from 'chess.ts';
import { SQUARES } from 'chess.ts';
import { Key } from 'chessground/types';

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
