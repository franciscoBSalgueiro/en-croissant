import type { DrawShape } from "@lichess-org/chessground/draw";
import { makeSquare, parseUci } from "chessops";

const engineColors = ["#003088", "#15781B", "#882020", "#e68f00"];

type EngineLines = Map<number, { pv: string[]; winChance: number }[]>;

/** Compare every displayed candidate's first move, counting each engine once per move. */
export function getEngineAgreements(arrows: EngineLines) {
    const votes = new Map<
        string,
        { orig: string; dest: string; colors: string[]; opacities: number[] }
    >();
    const displayedMoves = new Map<string, string>();
    for (const [engineIndex, lines] of [...arrows].sort(([a], [b]) => a - b)) {
        if (engineIndex < 0 || engineIndex >= engineColors.length) continue;
        const candidates = new Set<string>();
        for (const [rank, { pv }] of lines.entries()) {
            const move = pv[0];
            if (!move || candidates.has(move)) continue;
            candidates.add(move);
            const parsed = move && parseUci(move);
            if (!move || !parsed || !("from" in parsed)) continue;
            const orig = makeSquare(parsed.from);
            const dest = makeSquare(parsed.to);
            if (!orig || !dest) continue;
            // The board draws one arrow per endpoint pair. Preserve its first
            // candidate, including promotion type, instead of replacing it twice.
            const endpoints = `${orig}${dest}`;
            if (!displayedMoves.has(endpoints)) displayedMoves.set(endpoints, move);
            if (displayedMoves.get(endpoints) !== move) continue;
            const vote = votes.get(move) ?? { orig, dest, colors: [], opacities: [] };
            vote.colors.push(engineColors[engineIndex]);
            vote.opacities.push(rank === 0 ? 0.8 : 0.4);
            votes.set(move, vote);
        }
    }
    return [...votes.entries()]
        .filter(([, vote]) => vote.colors.length > 1)
        .map(([move, vote]) => ({ move, ...vote }));
}

/** Match Chessground's 16 direction slots for arrows converging at a destination. */
export function shortenAgreementArrow(dest: string, shapes: DrawShape[]): boolean {
    const angles = new Set(
        shapes
            .filter((shape) => shape.dest === dest && !shape.piece)
            .map((shape) => {
                const dx = dest.charCodeAt(0) - shape.orig.charCodeAt(0);
                const dy = Number(shape.orig[1]) - Number(dest[1]);
                return (Math.round((Math.atan2(dy, dx) * 8) / Math.PI) + 16) % 16;
            }),
    );
    return [...angles].some((angle) =>
        [1, 2, 3].some(
            (difference) =>
                angles.has((angle + difference) % 16) || angles.has((angle - difference + 16) % 16),
        ),
    );
}

/** Chessground's customSvg is anchored at the origin square (100 SVG units). */
export function agreementArrowShape(
    orig: string,
    dest: string,
    colors: string[],
    orientation: "white" | "black",
    boardId: string,
    {
        lineWidth = 11,
        shorten = false,
        opacities = [],
    }: { lineWidth?: number; shorten?: boolean; opacities?: number[] } = {},
): DrawShape {
    const direction = orientation === "white" ? 1 : -1;
    const dx = (dest.charCodeAt(0) - orig.charCodeAt(0)) * direction;
    const dy = (Number(orig[1]) - Number(dest[1])) * direction;
    const length = Math.hypot(dx, dy) * 100;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Chessground uses 1/64-square brush units and a stroke-scaled 3 × 4 marker
    // anchored at (2.05, 2). Keep the same silhouette as its ordinary arrows.
    const width = (Math.round(lineWidth) * 100) / 64;
    const endpoint = 50 + length - ((shorten ? 20 : 10) * 100) / 64;
    const shoulder = endpoint - 2.05 * width;
    const tip = endpoint + (3 - 2.05) * width;
    const shaftTop = 50 - width / 2;
    const headTop = 50 - 2 * width;
    const clipId = `engine-agreement-${boardId}-${orig}-${dest}`;
    // The first contributor owns the shaft. Stop its fill at the shoulder so
    // its color cannot show through the other contributors' translucent head.
    const shaftFill = `<rect x="${50 - width / 2}" y="${shaftTop}" width="${shoulder - (50 - width / 2)}" height="${width}" fill="${colors[0]}" opacity="${opacities[0] ?? 0.8}"/>`;
    const headColors = colors.slice(1);
    const headSegments = headColors
        .map((color, index) => {
            const top = headTop + (4 * width * index) / headColors.length;
            const bottom = headTop + (4 * width * (index + 1)) / headColors.length;
            return `<path d="M${shoulder} ${top} L${tip} 50 L${shoulder} ${bottom} Z" fill="${color}" opacity="${opacities[index + 1] ?? 0.8}"/>`;
        })
        .join("");
    const head = `M${shoulder} ${headTop} L${tip} 50 L${shoulder} ${50 + 2 * width} Z`;
    const shaft = `<rect x="${50 - width / 2}" y="${shaftTop}" width="${endpoint - 50 + width}" height="${width}" rx="${width / 2}"/>`;
    return {
        orig: orig as DrawShape["orig"],
        dest: dest as DrawShape["dest"],
        below: true,
        customSvg: {
            html: `<g transform="rotate(${angle} 50 50)"><defs><clipPath id="${clipId}-shaft">${shaft}</clipPath><clipPath id="${clipId}"><path d="${head}"/></clipPath></defs><g clip-path="url(#${clipId}-shaft)">${shaftFill}</g><g clip-path="url(#${clipId})">${headSegments}</g></g>`,
        },
    };
}
