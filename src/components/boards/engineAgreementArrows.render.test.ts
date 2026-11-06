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

function expectHeadOnlyColors(arrow: Element, colors: string[], opacities: number[]) {
    const numbers = (path: Element) =>
        path
            .getAttribute("d")!
            .match(/-?[\d.]+/g)!
            .map(Number);
    const head = numbers(arrow.querySelector("clipPath path")!);
    const [shoulder, top, tip, middle, bottomX, bottom] = head;
    expect(bottomX).toBeCloseTo(shoulder);
    const shaft = arrow.querySelector("rect[fill]")!;
    expect(arrow.querySelectorAll("rect[fill]")).toHaveLength(1);
    expect(shaft.getAttribute("fill")).toBe(colors[0]);
    expect(Number(shaft.getAttribute("opacity"))).toBe(opacities[0]);
    // A translucent fan must not reveal the shaft's color underneath its head.
    expect(Number(shaft.getAttribute("x")) + Number(shaft.getAttribute("width"))).toBeCloseTo(
        shoulder,
    );
    expect(arrow.querySelectorAll("g[opacity]")).toHaveLength(0);

    const fan = [...arrow.querySelectorAll("path[fill]")];
    expect(fan).toHaveLength(colors.length - 1);
    expect(arrow.querySelectorAll(`path[fill="${colors[0]}"]`)).toHaveLength(0);
    // Each equal base segment meets the same tip: together these triangles
    // cover the full head without reserving a segment for the shaft's color.
    for (const [index, segment] of fan.entries()) {
        expect(segment.getAttribute("fill")).toBe(colors[index + 1]);
        expect(Number(segment.getAttribute("opacity"))).toBe(opacities[index + 1]);
        const points = numbers(segment);
        expect(points).toHaveLength(6);
        const pairs = [points.slice(0, 2), points.slice(2, 4), points.slice(4, 6)];
        const apex = pairs.find(
            ([x, y]) => Math.abs(x - tip) < 0.000001 && Math.abs(y - middle) < 0.000001,
        );
        expect(apex).toBeDefined();
        const base = pairs.filter((pair) => pair !== apex).sort((a, b) => a[1] - b[1]);
        expect(base).toHaveLength(2);
        expect(base[0][0]).toBeCloseTo(shoulder);
        expect(base[1][0]).toBeCloseTo(shoulder);
        expect(base[0][1]).toBeCloseTo(top + ((bottom - top) * index) / fan.length);
        expect(base[1][1]).toBeCloseTo(top + ((bottom - top) * (index + 1)) / fan.length);
        const clipId = segment.parentElement!.getAttribute("clip-path")!.slice(5, -1);
        expect(arrow.querySelector(`clipPath[id="${clipId}"] path`)?.getAttribute("d")).toBe(
            arrow.querySelector("clipPath path")!.getAttribute("d"),
        );
    }
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
                                { opacities: agreement.opacities },
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
                expectHeadOnlyColors(arrow, agreement.colors, Array(count).fill(0.8));
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

        it.each([
            { stockfishRank: 1, otherRank: 0, extraRanks: [] },
            { stockfishRank: 2, otherRank: 0, extraRanks: [] },
            { stockfishRank: 1, otherRank: 1, extraRanks: [] },
            { stockfishRank: 2, otherRank: 2, extraRanks: [] },
            { stockfishRank: 1, otherRank: 0, extraRanks: [1] },
            { stockfishRank: 2, otherRank: 0, extraRanks: [1, 0] },
        ])(
            `keeps candidate $stockfishRank shaft and candidate $otherRank head opacity with extra ranks $extraRanks and ${orientation} orientation`,
            ({ stockfishRank, otherRank, extraRanks }) => {
                const lines = (rank: number, preceding: string[]) => [
                    ...preceding.slice(0, rank).map((move) => ({ pv: [move], winChance: 55 })),
                    { pv: ["d2d4"], winChance: 49 },
                ];
                const arrows = new Map([
                    [0, lines(stockfishRank, ["e2e4", "c2c4"])],
                    [1, lines(otherRank, ["g1f3", "b1c3"])],
                ]);
                extraRanks.forEach((rank, index) => arrows.set(index + 2, lines(rank, ["a2a3"])));
                const agreements = getEngineAgreements(arrows);
                const agreement = agreements.find(({ move }) => move === "d2d4")!;
                const opacities = [
                    0.4,
                    ...[otherRank, ...extraRanks].map((rank) => (rank === 0 ? 0.8 : 0.4)),
                ];
                expect(agreement.opacities).toEqual(opacities);
                const lineWidth = stockfishRank === 1 ? 7.5 : 4;
                const normal: DrawShape = {
                    orig: "d2",
                    dest: "d4",
                    brush: "paleBlue",
                    modifiers: { lineWidth },
                };
                api = Chessground(board, {
                    orientation,
                    viewOnly: true,
                    drawable: {
                        autoShapes: [
                            normal,
                            agreementArrowShape(
                                agreement.orig,
                                agreement.dest,
                                agreement.colors,
                                orientation,
                                "secondary-test",
                                { lineWidth, opacities: agreement.opacities },
                            ),
                        ],
                    },
                });
                expectHeadOnlyColors(
                    board.querySelector(".cg-custom-below svg")!,
                    agreement.colors,
                    opacities,
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
            expectHeadOnlyColors(
                board.querySelector(".cg-custom-below svg")!,
                ["#003088", "#15781B"],
                [0.8, 0.8],
            );
        },
    );
});
