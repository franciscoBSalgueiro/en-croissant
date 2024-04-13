import type {
  BestMoves as BestMovesT,
  Score as ScoreT,
  ScoreValue as ScoreValueT,
} from "./generated";

export * from "./generated";
export type ScoreValue = ScoreValueT | { type: "dtz"; value: number };
export type Score = Omit<ScoreT, "value"> & { value: ScoreValue };
export type BestMoves = Omit<BestMovesT, "score"> & {
  score: Score;
};
