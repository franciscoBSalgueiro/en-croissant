import FilesPage from "@/components/files/FilesPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/files")({
  component: FilesPage,
  loader: ({ context: { loadDirs } }) => loadDirs(),
});
