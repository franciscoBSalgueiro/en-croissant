import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import boardCss from "@/styles/chessgroundBaseOverride.css?raw";
import { agreementArrowShape, getEngineAgreements } from "./engineAgreementArrows";

describe("engine agreement arrows in Chessground", () => {
    let board: HTMLDivElement;
    let stylesheet: HTMLStyleElement;
    let api: Api | undefined;

    beforeEach(() => {
        stylesheet = document.createElement("style");
        stylesheet.textContent = boardCss;
        document.head.appendChild(stylesheet);
        board = document.createElement("div");
        document.body.appendChild(board);
        // jsdom has no layout; provide board geometry to the real SVG renderer.
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
            new DOMRect(0, 0, 800, 800),
        );
    });

    afterEach(() => {
        api?.destroy();
        api = undefined;
        board.remove();
        stylesheet.remove();
        vi.restoreAllMocks();
    });

    for (const orientation of ["white", "black"] as const) {
        it.each(
            [2, 3, 4].flatMap((count) => [
                { count, move: "a1b1", angle: 0, fen: "r7/8/8/8/8/2k5/8/K7 w - - 0 1" },
                { count, move: "a1h8", angle: -45, fen: "8/7k/8/8/8/8/8/BK6 w - - 0 1" },
            ]),
        )(
            `keeps $count agreeing engine colors visible on $move with ${orientation} orientation`,
            ({ count, move, angle, fen }) => {
                const arrows = new Map(
                    Array.from({ length: count }, (_, index) => [
                        index,
                        [{ pv: [move], winChance: 50 }],
                    ]),
                );
                const [agreement] = getEngineAgreements(arrows);
                expect(agreement.colors).toHaveLength(count);
                api = Chessground(board, {
                    fen,
                    orientation,
                    viewOnly: true,
                    drawable: {
                        autoShapes: [
                            agreementArrowShape(
                                agreement.orig,
                                agreement.dest,
                                agreement.colors,
                                orientation,
                                "render-test",
                            ),
                        ],
                    },
                });

                const layer = board.querySelector<SVGSVGElement>(".cg-custom-below")!;
                const style = getComputedStyle(layer);
                expect(style.display).not.toBe("none");
                expect(style.position).toBe("absolute");
                expect(style.width).toBe("100%");
                expect(style.height).toBe("100%");
                expect(style.top).toBe("0px");
                expect(style.left).toBe("0px");
                expect(style.pointerEvents).toBe("none");
                expect(style.overflow).toBe("visible");
                expect(Number(style.zIndex)).toBeGreaterThanOrEqual(0);
                expect(Number(style.zIndex)).toBeLessThan(
                    Number(getComputedStyle(board.querySelector("piece")!).zIndex),
                );

                const arrow = layer.querySelector("svg")!;
                // The arrow crosses the origin square's nested SVG viewport.
                expect(getComputedStyle(arrow).overflow).toBe("visible");
                expect(arrow.querySelectorAll("rect")).toHaveLength(count * 2);
                for (const color of agreement.colors) {
                    expect(arrow.querySelectorAll(`rect[fill="${color}"]`)).toHaveLength(2);
                }
                expect(arrow.querySelector("g")?.getAttribute("transform")).toBe(
                    `rotate(${orientation === "white" ? angle : angle === 0 ? -180 : angle + 180} 50 50)`,
                );
                const clip = arrow.querySelector("clipPath")!;
                expect(arrow.querySelector("g[clip-path]")?.getAttribute("clip-path")).toBe(
                    `url(#${clip.id})`,
                );
            },
        );
    }
});
