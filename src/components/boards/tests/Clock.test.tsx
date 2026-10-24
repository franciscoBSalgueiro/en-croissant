import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { defaultTree } from "@/utils/treeReducer";
import { TreeStateContext } from "../../common/TreeStateContext";
import Clock from "../Clock";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test.each(["white", "black"] as const)(
  "%s clock stays visible at zero and hides when absent",
  async (color) => {
    const store = createTreeStore(undefined, defaultTree());
    async function render(milliseconds?: number) {
      await act(async () =>
        root.render(
          <MantineProvider env="test">
            <TreeStateContext.Provider value={store}>
              <Clock color={color} turn={color} whiteTime={milliseconds} blackTime={milliseconds} />
            </TreeStateContext.Provider>
          </MantineProvider>,
        ),
      );
    }
    await render(1500);
    const paper = container.querySelector<HTMLElement>(".mantine-Paper-root")!;
    expect(paper.style.visibility).toBe("visible");
    expect(paper.textContent).toBe("00:01.5");
    await render(0);
    expect(paper.style.visibility).toBe("visible");
    expect(paper.textContent).toBe("00:00.0");
    expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe(
      "0",
    );
    await render();
    expect(paper.style.visibility).toBe("hidden");
  },
);
