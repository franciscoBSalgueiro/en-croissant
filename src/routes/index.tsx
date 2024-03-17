import BoardsPage from "@/components/tabs/BoardsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: BoardsPage,
  loader: ({ context: { loadDirs } }) => loadDirs(),
});
