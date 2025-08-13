import type { GoMode } from "@/bindings";
import { z } from "zod";

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
});

export type Bot = z.infer<typeof botSchema>; 