import { type TreeStore, createTreeStore } from "@/state/store";
import type { TreeState } from "@/utils/treeReducer";
import { createContext, useRef } from "react";

export const TreeStateContext = createContext<TreeStore | null>(null);

export function TreeStateProvider({
  id,
  initial,
  children,
}: {
  id?: string;
  initial?: TreeState;
  children: React.ReactNode;
}) {
  const store = useRef(createTreeStore(id, initial)).current;

  return (
    <TreeStateContext.Provider value={store}>
      {children}
    </TreeStateContext.Provider>
  );
}
