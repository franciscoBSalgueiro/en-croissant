import { createFileRoute } from "@tanstack/react-router";
import GameHistory from "@/components/games/GameHistory";
export const Route = createFileRoute("/games")({ component: GameHistory });
