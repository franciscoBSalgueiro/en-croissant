import type {
  BestMoves as BestMovesT,
  Score as ScoreT,
  ScoreValue as ScoreValueT,
  DatabaseInfo as DatabaseInfoT,
  GameQueryJs,
} from "./generated";

export * from "./generated";
export type ScoreValue = ScoreValueT | { type: "dtz"; value: number };
export type Score = Omit<ScoreT, "value"> & { value: ScoreValue };
export type BestMoves = Omit<BestMovesT, "score"> & {
  score: Score;
};

export type DatabaseInfo =
  | (DatabaseInfoT & {
      type: "success";
      file: string;
      downloadLink?: string;
    })
  | {
      type: "error";
      file: string;
      filename: string;
      error: string;
      indexed: boolean;
    };

export type GameQuery = GameQueryJs;
