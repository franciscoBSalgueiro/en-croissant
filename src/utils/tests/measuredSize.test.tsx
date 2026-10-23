import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { useMeasuredSize } from "@/hooks/useMeasuredSize";

// jsdom lays nothing out: every element has this size, and resizes are reported by hand
let size = { width: 800, height: 600 };
let reportResize: (() => void)[] = [];
let root: Root;

beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe() {
        reportResize.push(this.callback);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ ...size, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 }) as DOMRect,
  );
});

beforeEach(() => {
  size = { width: 800, height: 600 };
  reportResize = [];
  root = createRoot(document.body.appendChild(document.createElement("div")));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

// A tab: the home screen, or a board whose area is measured
function Tab({ showsBoard }: { showsBoard: boolean }) {
  const { ref, width, height } = useMeasuredSize<HTMLDivElement>();
  return (
    <>
      {showsBoard && <div ref={ref} />}
      <output>{`${width}x${height}`}</output>
    </>
  );
}

const shownSize = () => document.querySelector("output")?.textContent;

test.each([
  ["from the start", [true]],
  // Home › Analysis Board or Import Game turn the home tab into a board
  ["after the tab showed the home screen", [false, true]],
])(
  "a board area is measured as soon as it appears %s, without waiting for a resize",
  async (_, steps) => {
    for (const showsBoard of steps) {
      await act(async () => root.render(<Tab showsBoard={showsBoard} />));
    }
    expect(shownSize()).toBe("800x600");
  },
);

test("a resized board area is measured again", async () => {
  await act(async () => root.render(<Tab showsBoard />));
  size = { width: 1000, height: 700 };
  await act(async () => reportResize.forEach((report) => report()));
  expect(shownSize()).toBe("1000x700");
});
