import { createFileRoute, redirect } from "@tanstack/react-router";
import { getDefaultStore } from "jotai";
import DatabasesPage from "@/components/databases/DatabasesPage";
import { selectedDatabaseAtom } from "@/state/atoms";
import { activeDatabaseViewStore } from "@/state/store/database";

export const Route = createFileRoute("/databases/")({
  component: DatabasesPage,
  beforeLoad: async () => {
    const db = activeDatabaseViewStore.getState().database;

    if (db) {
      throw redirect({
        to: "/databases/$databaseId",
        params: { databaseId: db.title },
      });
    }
    return null;
  },
});
