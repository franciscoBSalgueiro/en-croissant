import type {
    BestMoves as BestMovesT,
    DatabaseInfo as DatabaseInfoT,
    GameQuery,
    Score as ScoreT,
    ScoreValue as ScoreValueT,
} from "./generated";

export * from "./generated";
export type ScoreValue = ScoreValueT | { type: "dtz"; value: number };
export type Score = Omit<ScoreT, "value"> & { value: ScoreValue };
export type BestMoves = Omit<BestMovesT, "score" | "probability"> & {
    score: Score;
    probability?: number | null;
};

export type DatabaseInfo =
    | (DatabaseInfoT & {
          type: "success";
          file: string;
          downloadLink?: string;
          filter?: GameQuery;
      })
    | {
          type: "error";
          file: string;
          filename: string;
          error: string;
          indexed: boolean;
      };
