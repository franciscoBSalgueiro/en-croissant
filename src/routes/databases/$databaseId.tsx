import DatabaseView from "@/components/databases/DatabaseView";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/databases/$databaseId")({
  component: DatabaseView,
});
