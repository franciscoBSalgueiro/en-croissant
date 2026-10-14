import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TablebaseInfo from "./TablebaseInfo";

const { tablebaseState } = vi.hoisted(() => ({
  tablebaseState: { error: undefined as unknown, data: undefined, isLoading: false },
}));

vi.mock("swr/immutable", () => ({ default: () => tablebaseState }));
vi.mock("@/utils/lichess/api", () => ({ getTablebaseInfo: vi.fn() }));
vi.mock("zustand", () => ({ useStore: () => vi.fn() }));
vi.mock("@/components/common/TreeStateContext", async () => {
  const { createContext } = await import("react");
  return { TreeStateContext: createContext({}) };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function renderPanel() {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      {},
      createElement(TablebaseInfo, { fen: "8/8/8/8/8/2k5/8/K7 w - - 0 1", turn: "white" }),
    ),
  );
}

describe("tablebase request errors", () => {
  beforeEach(() => {
    tablebaseState.error = undefined;
  });

  it("renders a rejected request's Error message without crashing React", () => {
    tablebaseState.error = new Error("Failed to load tablebase info");
    expect(renderPanel()).toContain("Failed to load tablebase info");
  });

  it("also renders string rejections", () => {
    tablebaseState.error = "Network unavailable";
    expect(renderPanel()).toContain("Network unavailable");
  });
});
