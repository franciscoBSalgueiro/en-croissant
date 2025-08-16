import { z } from "zod";

export const playerSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	elo: z.number().min(400).max(3600).default(1500).optional(),
	earnedELO: z.number().min(400).max(3600).optional(),
	lichess: z
		.object({ username: z.string().min(1) })
		.optional(),
	chessCom: z
		.object({ username: z.string().min(1) })
		.optional(),
});

export type Player = z.infer<typeof playerSchema>;


