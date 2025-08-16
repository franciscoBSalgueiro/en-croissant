export type OpponentSettings =
  | {
      type: "human";
      timeControl?: any;
      playerId?: string;
      name?: string;
    }
  | {
      type: "engine";
      timeControl?: any;
      engine: any | null; // null means Bot mode
      go: any;
      // Bot-specific fields (when engine is null)
      pickRank?: number;
      strategy?: { mode: "rank"; rank: number } | { mode: "randomTopN"; topN: number } | { mode: "rankSet"; ranks: number[] };
      elo?: number;
      botId?: string;
      confThreshold?: number;
      thinkingDelayMinMs?: number;
      thinkingDelayMaxMs?: number;
      name?: string;
    };


