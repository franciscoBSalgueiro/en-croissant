import HomePage from "@/components/home/HomePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/accounts")({
  component: HomePage,
});
