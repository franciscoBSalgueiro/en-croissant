import PlayersPage from "@/components/players/PlayersPage";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	selected: z.number().optional(),
});

export const Route = createFileRoute("/players")({
	component: PlayersPage,
	validateSearch: searchSchema,
});


