import { createContext } from "react";
import type { activeDatabaseViewStore } from "@/state/store/database";

export const DatabaseViewStateContext = createContext<typeof activeDatabaseViewStore | null>(null);
