import { z } from "zod";

// Strategy for selecting a move from unifiedMoves
export type BotStrategy =
	| { mode: "rank"; rank: number }
	| { mode: "rankSet"; ranks: number[] }
	| { mode: "randomTopN"; topN: number };

export const botStrategySchema: z.ZodSchema<BotStrategy> = z.union([
	z.object({ mode: z.literal("rank"), rank: z.number().min(1).max(100) }),
	z.object({ mode: z.literal("rankSet"), ranks: z.array(z.number().min(1).max(100)).min(1) }),
	z.object({ mode: z.literal("randomTopN"), topN: z.number().min(1).max(100) }),
]);

export const botSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	// Legacy: Nth best move; used to derive default strategy if strategy is absent
	pickRank: z.number().min(1).max(100).default(1).optional(),
	// New flexible strategy
	strategy: botStrategySchema.optional(),
	// Confidence override: if set, consider only moves with confidence >= threshold for selection
	confThreshold: z.number().min(0).max(100).default(90).optional(),
	// Thinking delay (ms)
	thinkingDelayMinMs: z.number().min(0).max(60000).default(1000).optional(),
	thinkingDelayMaxMs: z.number().min(0).max(60000).default(10000).optional(),
});

export type Bot = z.infer<typeof botSchema>;

export function deriveStrategyFromBot(bot: Bot): BotStrategy {
	if (bot.strategy) return bot.strategy;
	const rank = Math.max(1, Math.min(100, bot.pickRank ?? 1));
	return { mode: "rank", rank };
} 