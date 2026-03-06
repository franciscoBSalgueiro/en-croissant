import { createFileRoute } from "@tanstack/react-router";
import BoardsPage from "@/components/tabs/BoardsPage";

export const Route = createFileRoute("/")({
  component: BoardsPage,
  loader: ({ context: { loadDirs } }) => loadDirs(),
});
