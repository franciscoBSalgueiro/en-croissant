import { MantineProvider } from "@mantine/core";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider, type WritableAtom } from "jotai";
import type { ReactElement, ReactNode } from "react";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { createTreeStore } from "@/state/store/tree";
import type { TreeState } from "@/utils/treeReducer";

type AtomValue = readonly [WritableAtom<unknown, [never], unknown>, unknown];

/** Pairs an atom with its initial value, keeping the two types in sync */
export function atomValue<T>(atom: WritableAtom<T, [T], unknown>, value: T): AtomValue {
  return [atom as WritableAtom<unknown, [never], unknown>, value];
}

export type ProvidersOptions = {
  /** Game tree for the `TreeStateContext`; an empty game when not given */
  tree?: TreeState;
  /** Initial atom values, e.g. `[atomValue(tableViewAtom, true)]` */
  atoms?: AtomValue[];
};

/**
 * Renders a component inside the providers the app gives it: Mantine, a fresh jotai store and a
 * tree store. Returns the Testing Library queries plus `user`, `treeStore` and `jotaiStore`.
 */
export function renderWithProviders(
  ui: ReactElement,
  { tree, atoms = [], ...options }: ProvidersOptions & Omit<RenderOptions, "wrapper"> = {},
) {
  const user = userEvent.setup();
  const jotaiStore = createStore();
  for (const [atom, value] of atoms) {
    jotaiStore.set(atom, value as never);
  }
  const treeStore = createTreeStore(undefined, tree);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider>
        <Provider store={jotaiStore}>
          <TreeStateContext.Provider value={treeStore}>{children}</TreeStateContext.Provider>
        </Provider>
      </MantineProvider>
    );
  }

  return {
    user,
    jotaiStore,
    treeStore,
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}
