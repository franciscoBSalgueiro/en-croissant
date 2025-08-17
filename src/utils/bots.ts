import { z } from "zod";
import type { UnifiedMove } from "@/state/unifiedMoves";

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
	// Bot playing strength (used to shape softmax sampling)
	elo: z.number().min(400).max(3600).default(1500).optional(),
	// Engine Skill Level (UCI) when running a dedicated engine for this bot (e.g., Stockfish 0..20)
	skillLevel: z.number().min(0).max(20).optional(),
	// Earned ELO, adjusted after games. Defaults to elo when absent
	earnedELO: z.number().min(400).max(3600).optional(),
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

// Select a move from unified moves using the bot's strategy and optional confidence threshold
export function selectUnifiedMove(
	moves: readonly UnifiedMove[] | undefined,
	strategy: BotStrategy | undefined,
	confThreshold?: number,
	elo?: number,
): UnifiedMove | null {
	if (!moves || moves.length === 0) return null;

	const basePool = Array.isArray(moves) ? [...moves] : [];
	const filteredByConf =
		typeof confThreshold === "number"
			? basePool.filter((m: any) => typeof (m as any).confidence === "number" && (m as any).confidence >= confThreshold)
			: basePool;
	const candidatePool = filteredByConf.length > 0 ? filteredByConf : basePool;

	// Ensure selection uses Rank semantics: sort by rank asc and pick by rank property
	const sortedByRank: any[] = [...candidatePool].sort((a: any, b: any) => {
		const ar = typeof a?.rank === "number" ? a.rank : Number.POSITIVE_INFINITY;
		const br = typeof b?.rank === "number" ? b.rank : Number.POSITIVE_INFINITY;
		return ar - br;
	});

	// Forced-mate awareness: allow low-ELO bots to miss mates with some probability
	const forcedMates = sortedByRank.filter((m: any) => {
		const sv: any | undefined = m?.score?.value;
		return sv && sv.type === "mate" && typeof sv.value === "number" && sv.value > 0;
	});
	if (forcedMates.length > 0) {
		// pick the quickest mate candidate
		forcedMates.sort((a: any, b: any) => (a.score.value.value as number) - (b.score.value.value as number));
		const quickestMate = forcedMates[0] as UnifiedMove;
		// Probability to see/take a mate scales with ELO: 0% at 400 -> ~100% at 3000+
		const e = Number.isFinite(elo as any) ? Number(elo) : 1500;
		const pSeeMate = (() => {
			const minE = 400, maxE = 3000;
			const t = Math.max(0, Math.min(1, (e - minE) / (maxE - minE)));
			return 0.05 + 0.95 * t; // 5% .. 100%
		})();
		if (Math.random() < pSeeMate) return quickestMate;
		// else: intentionally allow missing the mate; continue to softmax selection
	}

	// Strong rule: if there is an only move and ELO is high, choose it deterministically
	if ((elo ?? 0) >= 2000) {
		const onlyMoves = sortedByRank.filter((m: any) => m?.isOnlyMove === true);
		if (onlyMoves.length > 0) {
			// choose highest-ranked only move
			return onlyMoves[0] as UnifiedMove;
		}
	}

	// ELO -> sampling sharpness
	const effectiveElo = Number.isFinite(elo as any) ? Number(elo) : 1500;
	const alpha = (() => {
		const minElo = 400;
		const maxElo = 3600;
		const t = Math.max(0, Math.min(1, (effectiveElo - minElo) / (maxElo - minElo)));
		return 0.8 + t * 7.2; // 0.8 .. 8.0 sharper range
	})();

	const pickBySoftConfidence = (items: any[]): any | undefined => {
		if (!items || items.length === 0) return undefined;
		// Bias against blunders: if a move is far below the best confidence, downweight steeply at higher ELO
		const bestConf = Math.max(...items.map((m: any) => (typeof m?.confidence === "number" ? m.confidence : 0)));
		const probs = items.map((m, i) => {
			const conf = typeof m?.confidence === "number" ? Math.max(0, Math.min(100, m.confidence)) / 100 : undefined;
			if (conf !== undefined) {
				const base = Math.pow(Math.max(conf, 1e-6), alpha);
				if (effectiveElo >= 2200 && bestConf > 0) {
					const pctBest = (conf * 100) / bestConf;
					// If below 60% of best, penalize multiplicatively (strong players less likely to pick bad moves)
					const penalty = pctBest < 60 ? 0.2 : pctBest < 75 ? 0.5 : 1.0;
					return base * penalty;
				}
				return base;
			}
			const r = typeof m?.rank === "number" ? m.rank : i + 1;
			return Math.pow(1 / Math.max(1, r), alpha);
		});
		const sum = probs.reduce((a, b) => a + b, 0);
		if (!(sum > 0)) return items[0];
		let rnd = Math.random() * sum;
		for (let i = 0; i < items.length; i++) {
			rnd -= probs[i];
			if (rnd <= 0) return items[i];
		}
		return items[items.length - 1];
	};

	let choice: any | undefined;
	if (!strategy || strategy.mode === "rank") {
		const rank = Math.max(1, Math.min(100, (strategy as any)?.rank ?? 1));
		choice = sortedByRank.find((m) => m?.rank === rank) || sortedByRank[0];
	} else if (strategy.mode === "rankSet") {
		const ranks: number[] = (strategy.ranks || []).filter((r) => r >= 1 && r <= 100);
		const available = ranks
			.map((r) => sortedByRank.find((m) => m?.rank === r))
			.filter((m) => m != null) as any[];
		choice = available.length > 0 ? pickBySoftConfidence(available) : sortedByRank[0];
	} else if (strategy.mode === "randomTopN") {
		const topN = Math.max(1, Math.min(100, strategy.topN));
		const pool = sortedByRank.slice(0, topN);
		choice = pickBySoftConfidence(pool) || sortedByRank[0];
	}

	return (choice as UnifiedMove) ?? null;
}

export function computeBotDelay(minMs?: number, maxMs?: number): number {
	const min = Math.max(0, Number(minMs ?? 200));
	const max = Math.max(min, Number(maxMs ?? 1200));
	return min + Math.floor(Math.random() * (max - min + 1));
}