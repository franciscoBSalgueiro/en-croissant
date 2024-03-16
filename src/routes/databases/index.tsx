import { selectedDatabaseAtom } from "@/atoms/atoms";
import DatabasesPage from "@/components/databases/DatabasesPage";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getDefaultStore } from "jotai";

export const Route = createFileRoute("/databases/")({
  component: DatabasesPage,
  beforeLoad: async () => {
    const store = getDefaultStore();
    const db = store.get(selectedDatabaseAtom)?.title;
    if (db) {
      throw redirect({
        to: "/databases/$databaseId",
        params: { databaseId: db },
      });
    }
    return null;
  },
});
