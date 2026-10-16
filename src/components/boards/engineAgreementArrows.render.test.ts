import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import boardCss from "@/styles/chessgroundBaseOverride.css?raw";
import {
    agreementArrowShape,
    getEngineAgreements,
    shortenAgreementArrow,
} from "./engineAgreementArrows";

function expectMatchingNativeArrow(board: HTMLElement) {
    const line = board.querySelector<SVGLineElement>(".cg-shapes line")!;
    const number = (element: Element, name: string) => Number(element.getAttribute(name));
    const width = number(line, "stroke-width") * 100;
    const length =
        Math.hypot(
            number(line, "x2") - number(line, "x1"),
            number(line, "y2") - number(line, "y1"),
        ) * 100;
    const markerId = line.getAttribute("marker-end")!.slice(5, -1);
    const marker = board.querySelector<SVGMarkerElement>(`marker[id="${markerId}"]`)!;
    // Read the native renderer's triangle, rather than duplicating its dimensions.
    const nativePath = marker.querySelector("path")!.getAttribute("d")!;
    const [, left, top, bottom, tip, middle] = nativePath.match(
        /^M([\d.]+),([\d.]+) V([\d.]+) L([\d.]+),([\d.]+) Z$/,
    )!;
    const expectedHead = [
        [left, top],
        [tip, middle],
        [left, bottom],
    ].flatMap(([x, y]) => [
        50 + length + (Number(x) - number(marker, "refX")) * width,
        50 + (Number(y) - number(marker, "refY")) * width,
    ]);
    const head = board.querySelector(".cg-custom-below clipPath path")!;
    const actualHead = head
        .getAttribute("d")!
        .match(/-?[\d.]+/g)!
        .map(Number);
    expect(actualHead).toHaveLength(expectedHead.length);
    expectedHead.forEach((value, index) => expect(actualHead[index]).toBeCloseTo(value));

    const shaft = board.querySelector(".cg-custom-below clipPath rect")!;
    expect(line.getAttribute("stroke-linecap")).toBe("round");
    expect(number(shaft, "x")).toBeCloseTo(50 - width / 2);
    expect(number(shaft, "y")).toBeCloseTo(50 - width / 2);
    expect(number(shaft, "width")).toBeCloseTo(length + width);
    expect(number(shaft, "height")).toBeCloseTo(width);
    expect(number(shaft, "rx")).toBeCloseTo(width / 2);
}

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
                            {
                                orig: agreement.orig,
                                dest: agreement.dest,
                                brush: "blue",
                                modifiers: { lineWidth: 11 },
                            } as DrawShape,
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
                expect(arrow.querySelectorAll("rect[fill]")).toHaveLength(count * 2);
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
                expectMatchingNativeArrow(board);
            },
        );
    }

    it.each([
        { lineWidth: 4, otherSource: undefined },
        { lineWidth: 7.5, otherSource: undefined },
        { lineWidth: 11, otherSource: undefined },
        { lineWidth: 11, otherSource: "d2" }, // Nearby approach: shortened.
        { lineWidth: 11, otherSource: "a4" }, // Perpendicular: full length.
        { lineWidth: 11, otherSource: "e5" }, // Opposite: full length.
    ] as const)(
        "matches native width $lineWidth and destination spacing with source $otherSource",
        ({ lineWidth, otherSource }) => {
            expect.hasAssertions();
            const normal: DrawShape = {
                orig: "e2",
                dest: "e4",
                brush: "blue",
                modifiers: { lineWidth },
            };
            const shapes: DrawShape[] = [normal];
            if (otherSource) shapes.push({ orig: otherSource, dest: "e4", brush: "red" });
            const agreement = agreementArrowShape(
                "e2",
                "e4",
                ["#003088", "#15781B"],
                "white",
                "geometry-test",
                { lineWidth, shorten: shortenAgreementArrow("e4", shapes) },
            );
            api = Chessground(board, {
                viewOnly: true,
                drawable: { autoShapes: [normal, agreement, ...shapes.slice(1)] },
            });
            expectMatchingNativeArrow(board);
        },
    );
});
