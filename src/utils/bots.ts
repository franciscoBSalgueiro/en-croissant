import type { GoMode } from "@/bindings";
import { z } from "zod";

// Strategy for selecting a move from unifiedMoves
export type BotStrategy =
	| { mode: "rank"; rank: number }
	| { mode: "randomTopN"; topN: number };

export const botStrategySchema: z.ZodSchema<BotStrategy> = z.union([
	z.object({ mode: z.literal("rank"), rank: z.number().min(1).max(100) }),
	z.object({ mode: z.literal("randomTopN"), topN: z.number().min(1).max(100) }),
]);

// Reuse the GoMode structure from bindings via a parallel zod schema for storage validation
export const goModeSchema: z.ZodSchema<GoMode> = z.union([
	z.object({ t: z.literal("Depth"), c: z.number() }),
	z.object({ t: z.literal("Time"), c: z.number() }),
	z.object({ t: z.literal("Nodes"), c: z.number() }),
	z.object({ t: z.literal("Infinite") }),
]);

export const botSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	go: goModeSchema,
	// Legacy: Nth best move; used to derive default strategy if strategy is absent
	pickRank: z.number().min(1).max(10).default(1).optional(),
	// New flexible strategy
	strategy: botStrategySchema.optional(),
});

export type Bot = z.infer<typeof botSchema>;

export function deriveStrategyFromBot(bot: Bot): BotStrategy {
	if (bot.strategy) return bot.strategy;
	const rank = Math.max(1, Math.min(100, bot.pickRank ?? 1));
	return { mode: "rank", rank };
} 