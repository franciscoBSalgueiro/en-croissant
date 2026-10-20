import { MantineProvider } from "@mantine/core";
import type { Color } from "chessops";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ShowMaterial from "@/components/common/ShowMaterial";

// White is a knight up: Black's g8 knight is gone
const KNIGHT_UP = "rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function render(color: Color, mode: "diff" | "all" | "none") {
  return renderToStaticMarkup(
    <MantineProvider>
      <ShowMaterial fen={KNIGHT_UP} color={color} mode={mode} />
    </MantineProvider>,
  );
}

test("None hides the material in both player bars, even when one side is up material", () => {
  // The other settings do show material in this position, so there is something to hide
  expect(render("white", "diff")).toContain("+3");
  expect(render("white", "all")).toContain("<svg");

  const nothing = renderToStaticMarkup(<MantineProvider>{null}</MantineProvider>);
  // The board's top and bottom bars show one color each
  expect(render("white", "none")).toBe(nothing);
  expect(render("black", "none")).toBe(nothing);
});
