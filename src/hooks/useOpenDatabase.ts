import { useNavigate } from "@tanstack/react-router";
import { useActiveDatabaseViewStore } from "@/state/store/database";
import type { SuccessDatabaseInfo } from "@/utils/db";

// As Explore, or a double-click, on the Databases page
export function useOpenDatabase() {
    const navigate = useNavigate();
    const setActiveDatabase = useActiveDatabaseViewStore((s) => s.setDatabase);
    return (database: SuccessDatabaseInfo) => {
        setActiveDatabase(database);
        navigate({ to: "/databases/$databaseId", params: { databaseId: database.title } });
    };
}
