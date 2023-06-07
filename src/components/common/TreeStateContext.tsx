import { createContext, useEffect } from "react";
import { useImmerReducer } from "use-immer";
import treeReducer, {
  TreeAction,
  TreeState,
  defaultTree,
} from "../../utils/treeReducer";

export const TreeStateContext = createContext<TreeState>(defaultTree());
export const TreeDispatchContext = createContext<React.Dispatch<TreeAction>>(
  () => undefined
);

function getTreeFromSessionStorage(id: string): TreeState {
  const treeState = sessionStorage.getItem(id);
  if (treeState) {
    const parsed = JSON.parse(treeState);
    return parsed;
  } else {
    return defaultTree();
  }
}

export function TreeStateProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [treeState, dispatch] = useImmerReducer(
    treeReducer,
    id,
    getTreeFromSessionStorage
  );

  useEffect(() => {
    sessionStorage.setItem(id, JSON.stringify(treeState));
  }, [id, treeState]);

  return (
    <TreeStateContext.Provider value={treeState}>
      <TreeDispatchContext.Provider value={dispatch}>
        {children}
      </TreeDispatchContext.Provider>
    </TreeStateContext.Provider>
  );
}
