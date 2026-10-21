import type { Piece } from "@lichess-org/chessground/types";
import { MantineProvider } from "@mantine/core";
import type { Square } from "chessops";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import PieceComponent from "@/components/common/Piece";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia, which Mantine reads for the color scheme
window.matchMedia = (query) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;

afterEach(() => {
  document.body.innerHTML = "";
});

// A board on screen at (500, 100), 400px wide, so each square is 50px
function board() {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ left: 500, top: 100, right: 900, bottom: 500, width: 400, height: 400 }) as DOMRect;
  return { current: element };
}

type PutPiece = (square: Square, piece: Piece) => void;

// A white knight in the board editor's panel, which cuts off anything that leaves it
async function editorPanelKnight(putPiece: PutPiece) {
  const panel = document.createElement("div");
  panel.style.overflow = "hidden";
  document.body.append(panel);
  await act(async () =>
    createRoot(panel).render(
      <MantineProvider>
        <PieceComponent
          piece={{ role: "knight", color: "white" }}
          boardRef={board()}
          putPiece={putPiece}
          size={75}
          orientation="white"
          onClick={() => {}}
        />
      </MantineProvider>,
    ),
  );
  return { panel, knight: panel.querySelector<HTMLElement>(".white.knight")! };
}

async function mouse(target: EventTarget, type: string, x: number, y: number) {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }),
    );
  });
}

function draggedCopy(panel: HTMLElement) {
  return [...document.querySelectorAll<HTMLElement>(".white.knight")].find(
    (element) => !panel.contains(element),
  );
}

test("a piece dragged out of the editor panel is drawn on the page itself, so the panel can't cut it off", async () => {
  const putPiece = vi.fn<PutPiece>();
  const { panel, knight } = await editorPanelKnight(putPiece);

  await mouse(knight, "mousedown", 40, 40);
  await mouse(document, "mousemove", 300, 200);

  // The piece stays in the panel and a copy follows the cursor, outside the panel
  expect(panel.contains(knight)).toBe(true);
  const copy = draggedCopy(panel);
  expect(copy?.style.position).toBe("fixed");
  expect([copy?.style.left, copy?.style.top]).toEqual(["300px", "200px"]);

  // Released over e1 (the bottom row of a white-side board, fifth file)
  await mouse(document, "mouseup", 725, 475);
  expect(putPiece).toHaveBeenCalledWith(4, { role: "knight", color: "white" });
  expect(draggedCopy(panel)).toBeUndefined();
});

test("releasing a dragged piece off the board drops the copy and places nothing", async () => {
  const putPiece = vi.fn<PutPiece>();
  const { panel, knight } = await editorPanelKnight(putPiece);

  await mouse(knight, "mousedown", 40, 40);
  await mouse(document, "mousemove", 300, 200);
  expect(draggedCopy(panel)).toBeDefined();

  await mouse(document, "mouseup", 300, 200);
  expect(putPiece).not.toHaveBeenCalled();
  expect(draggedCopy(panel)).toBeUndefined();
});
