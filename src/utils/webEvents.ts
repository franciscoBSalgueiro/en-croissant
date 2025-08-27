import type { BestMoves } from "@/bindings";

export type WebBestMovesPayload = {
  engine: string;
  tab: string;
  fen: string;
  moves: string[];
  bestLines: BestMoves[];
  progress: number; // 1..100
};

type Listener = (payload: WebBestMovesPayload) => void;

const listeners = new Set<Listener>();

export function listenBestMoves(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitBestMoves(payload: WebBestMovesPayload): void {
  for (const cb of Array.from(listeners)) {
    try { cb(payload); } catch {}
  }
}


