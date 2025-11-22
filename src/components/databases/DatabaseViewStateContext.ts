import type { activeDatabaseViewStore } from "@/state/store/database";
import { createContext } from "react";

export const DatabaseViewStateContext = createContext<
  typeof activeDatabaseViewStore | null
>(null);
