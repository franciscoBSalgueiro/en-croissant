import { createFileRoute } from "@tanstack/react-router";
import FilesPage from "@/components/files/FilesPage";

export const Route = createFileRoute("/files")({
  component: FilesPage,
  loader: ({ context: { loadDirs } }) => loadDirs(),
});
