import type { DateInputProps } from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "zustand";
import { createTreeStore } from "@/state/store/tree";
import { headersToPGN } from "@/utils/chess";
import { defaultTree } from "@/utils/treeReducer";
import GameInfo from "./GameInfo";
import { TreeStateContext } from "./TreeStateContext";

vi.mock("@mantine/core", () => {
  const Container = ({ children }: ComponentProps<"div">) => <div>{children}</div>;
  return {
    Box: Container,
    Group: Container,
    Text: Container,
    UnstyledButton: ({ children, onClick }: ComponentProps<"button">) => (
      <button onClick={onClick}>{children}</button>
    ),
    Select: () => null,
  };
});
vi.mock("@mantine/dates", () => ({
  DateInput: ({ value, placeholder }: DateInputProps) => (
    <input
      data-testid="calendar"
      value={value ? dayjs(value).format("YYYY.MM.DD") : ""}
      placeholder={placeholder}
      readOnly
    />
  ),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../databases/FideInfo", () => ({ default: () => null }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn<() => void>() }));
vi.mock("@/bindings", () => ({ commands: {} }));

// The application initializes this plugin in index.tsx.
dayjs.extend(customParseFormat);

describe("GameInfo preserves raw PGN dates", () => {
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

  async function mount(date: string) {
    const initial = defaultTree();
    initial.headers = {
      ...initial.headers,
      event: "Original event",
      date,
      other: { ECO: "B20", UTCDate: "1963.03.??" },
    };
    const store = createTreeStore(undefined, initial);
    function Harness() {
      const headers = useStore(store, (state) => state.headers);
      return (
        <TreeStateContext.Provider value={store}>
          <GameInfo headers={headers} />
        </TreeStateContext.Provider>
      );
    }
    await act(async () => root.render(<Harness />));
    return store;
  }

  function dateInput() {
    return container.querySelector<HTMLInputElement>('input[placeholder="????.??.??"]')!;
  }

  async function type(input: HTMLInputElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it.each(["1963.03.??", "2024.??.??", "2024.13.32"])(
    "keeps %s through focus/blur and unrelated header edits",
    async (date) => {
      const store = await mount(date);
      expect(dateInput().value).toBe(date);
      expect(dateInput().readOnly).toBe(false);
      expect(container.querySelector('[data-testid="calendar"]')).toBeNull();
      const dirtyBefore = store.getState().dirty;
      await act(async () => {
        dateInput().focus();
        dateInput().blur();
      });
      expect(store.getState().dirty).toBe(dirtyBefore);
      expect(store.getState().headers.date).toBe(date);

      const event = container.querySelector<HTMLInputElement>(
        'input[placeholder="Unknown Event"]',
      )!;
      await type(event, "Edited event");
      expect(store.getState().headers.event).toBe("Edited event");
      expect(store.getState().headers.date).toBe(date);
      const exported = headersToPGN(store.getState().headers);
      expect(exported).toContain(`[Date "${date}"]`);
      expect(exported).toContain('[ECO "B20"]');
      expect(exported).toContain('[UTCDate "1963.03.??"]');
    },
  );

  it("accepts an explicit raw-date edit and clear without substituting a normalized date", async () => {
    const store = await mount("1963.03.??");
    await type(dateInput(), "2024.??.??");
    expect(store.getState().headers.date).toBe("2024.??.??");
    expect(dateInput().value).toBe("2024.??.??");
    expect(headersToPGN(store.getState().headers)).toContain('[Date "2024.??.??"]');

    await type(dateInput(), "");
    expect(store.getState().headers.date).toBeUndefined();
    expect(container.querySelector('[data-testid="calendar"]')).not.toBeNull();
    expect(dateInput().value).toBe("");
    expect(headersToPGN(store.getState().headers)).toContain('[Date "????.??.??"]');
  });

  it("retains the calendar for a valid full date, including a corrected raw date", async () => {
    const store = await mount("2024.02.30");
    expect(container.querySelector('[data-testid="calendar"]')).toBeNull();
    await type(dateInput(), "2024.02.29");
    expect(store.getState().headers.date).toBe("2024.02.29");
    expect(container.querySelector('[data-testid="calendar"]')).not.toBeNull();
    expect(dateInput().value).toBe("2024.02.29");
  });

  it("keeps an entirely unknown date as the normal placeholder without rewriting storage", async () => {
    const store = await mount("????.??.??");
    expect(container.querySelector('[data-testid="calendar"]')).not.toBeNull();
    expect(dateInput().value).toBe("");
    expect(store.getState().headers.date).toBe("????.??.??");
  });

  it.each(["2024.02.29", ""])(
    "keeps focus while editing a raw date to %j, then restores the calendar on blur",
    async (value) => {
      const store = await mount("2024.02.??");
      const input = dateInput();
      await act(async () => input.focus());
      await type(input, value);
      expect(document.activeElement).toBe(input);
      expect(dateInput()).toBe(input);
      expect(input.value).toBe(value);
      expect(store.getState().headers.date).toBe(value || undefined);
      expect(container.querySelector('[data-testid="calendar"]')).toBeNull();

      await act(async () => input.blur());
      expect(container.querySelector('[data-testid="calendar"]')).not.toBeNull();
      expect(dateInput().value).toBe(value);
      expect(store.getState().headers.date).toBe(value || undefined);
    },
  );
});
