import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { moveNotationTypeAtom, tableViewAtom } from "@/state/atoms";
import { atomValue, renderWithProviders } from "@/test/render";
import { buildTree } from "@/test/tree";
import GameNotation from "./GameNotation";

const atoms = [atomValue(moveNotationTypeAtom, "letters"), atomValue(tableViewAtom, true)];

function cellTexts(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("GameNotation table view", () => {
  test("splits the row around a variation and fills the gaps with ...", () => {
    // 1. e4 (1. d4) e5 2. Nf3
    const tree = buildTree((s) => {
      s.makeMoves({ payload: ["e4", "e5", "Nf3"] });
      s.goToMove([]);
      s.makeMoves({ payload: ["d4"] });
    });
    renderWithProviders(<GameNotation />, { tree, atoms });

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(cellTexts(rows[0])).toEqual(["1", "e4", "..."]);
    expect(within(rows[1]).getByRole("button", { name: "d4" })).toBeInTheDocument();
    expect(cellTexts(rows[2])).toEqual(["1", "...", "e5"]);
    expect(cellTexts(rows[3])).toEqual(["2", "Nf3", ""]);
  });

  test("splits the row around a comment on White's move", () => {
    // 1. e4 {Best by test} e5
    const tree = buildTree((s) => {
      s.makeMoves({ payload: ["e4"] });
      s.setComment("Best by test");
      s.makeMoves({ payload: ["e5"] });
    });
    renderWithProviders(<GameNotation />, { tree, atoms });

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(cellTexts(rows[0])).toEqual(["1", "e4", "..."]);
    expect(rows[1]).toHaveTextContent("Best by test");
    expect(cellTexts(rows[2])).toEqual(["1", "...", "e5"]);
  });
});
