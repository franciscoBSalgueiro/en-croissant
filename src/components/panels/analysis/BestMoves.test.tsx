import { INITIAL_FEN } from "chessops/fen";
import { createStore, Provider } from "jotai";
import { act, type ComponentProps, type PropsWithChildren, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tabEngineSettingsFamily } from "@/state/atoms";
import type { LocalEngine } from "@/utils/engines";
import BestMoves from "./BestMoves";

vi.mock("@/state/atoms", async () => {
  const { atom } = await import("jotai");
  const { atomFamily } = await import("jotai/utils");
  const moves = atom(new Map());
  const progress = atom(0);
  return {
    activeTabAtom: atom("review"),
    currentThreatAtom: atom(false),
    currentDetachedEngineAtom: atom(null),
    enginesAtom: atom([]),
    engineMovesFamily: () => moves,
    engineProgressFamily: () => progress,
    tabEngineSettingsFamily: atomFamily(
      (_key: { engineId: string; tab: string }) =>
        atom({ enabled: false, settings: [], go: { t: "Infinite" }, synced: false }),
      (a, b) => a.engineId === b.engineId && a.tab === b.tab,
    ),
  };
});
vi.mock("@mantine/core", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  const Button = ({ children, onClick, disabled }: ComponentProps<"button">) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  return {
    Accordion: { Control: Container, Panel: Container },
    ActionIcon: Object.assign(Button, { Group: Container }),
    Box: Container,
    Code: Container,
    Collapse: () => null,
    Group: Container,
    Progress: () => null,
    Skeleton: () => null,
    Stack: Container,
    Text: Container,
    Table: Object.assign(Container, { Tbody: Container, Tr: Container, Td: Container }),
    Tooltip: Container,
    useMantineTheme: () => ({ primaryColor: "blue" }),
  };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./EngineSettingsForm", () => ({ default: () => null }));
vi.mock("./AnalysisRow", () => ({ default: () => null }));

const engines: LocalEngine[] = ["stockfish", "maia1600", "maia2600"].map((id) => ({
  id,
  name: id,
  version: "test",
  type: "local",
  path: "test-engine",
  loaded: true,
}));
const commonProps = {
  fen: INITIAL_FEN,
  moves: [],
  halfMoves: 0,
  orientation: "white" as const,
  dragHandleProps: {},
};

describe("BestMoves engine-toggle callbacks", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("uses the latest callback when the board and engine props have not changed", async () => {
    const store = createStore();
    const previous = vi.fn<(engineId: string, enabled: boolean) => void>();
    const current = vi.fn<(engineId: string, enabled: boolean) => void>();
    await act(async () =>
      root.render(
        <Provider store={store}>
          <BestMoves {...commonProps} id={0} engine={engines[0]} onEnabledChange={previous} />
        </Provider>,
      ),
    );
    await act(async () =>
      root.render(
        <Provider store={store}>
          <BestMoves {...commonProps} id={0} engine={engines[0]} onEnabledChange={current} />
        </Provider>,
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    expect(current).toHaveBeenCalledExactlyOnceWith("stockfish", true);
    expect(previous).not.toHaveBeenCalled();
  });

  it("keeps other review engines selected when enabling and disabling individual engines", async () => {
    const store = createStore();
    const settings = engines.map((engine) =>
      tabEngineSettingsFamily({ engineId: engine.id, tab: "review" }),
    );
    store.set(settings[0], { ...store.get(settings[0]), enabled: true });
    function Harness() {
      const [selected, setSelected] = useState(["stockfish"]);
      return (
        <Provider store={store}>
          <output>{selected.join(",")}</output>
          {engines.map((engine, index) => (
            <article key={engine.id} data-engine={engine.id}>
              <BestMoves
                {...commonProps}
                id={index}
                engine={engine}
                onEnabledChange={(engineId, enabled) => {
                  // Match the puzzle review's selection callback, including its captured array.
                  const next = enabled
                    ? [...new Set([...selected, engineId])]
                    : selected.filter((id) => id !== engineId);
                  setSelected(next);
                  engines.forEach((candidate, i) =>
                    store.set(settings[i], {
                      ...store.get(settings[i]),
                      enabled: next.includes(candidate.id),
                    }),
                  );
                }}
              />
            </article>
          ))}
        </Provider>
      );
    }
    await act(async () => root.render(<Harness />));
    async function toggle(id: string, expected: string[]) {
      await act(async () =>
        container.querySelector<HTMLButtonElement>(`article[data-engine="${id}"] button`)!.click(),
      );
      expect(container.querySelector("output")!.textContent).toBe(expected.join(","));
      expect(settings.map((atom) => store.get(atom).enabled)).toEqual(
        engines.map((engine) => expected.includes(engine.id)),
      );
    }
    await toggle("maia1600", ["stockfish", "maia1600"]);
    await toggle("maia2600", ["stockfish", "maia1600", "maia2600"]);
    await toggle("maia1600", ["stockfish", "maia2600"]);
    await toggle("maia1600", ["stockfish", "maia2600", "maia1600"]);
  });
});
