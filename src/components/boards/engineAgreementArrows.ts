import type { DrawShape } from "@lichess-org/chessground/draw";
import { makeSquare, parseUci } from "chessops";

const engineColors = ["#003088", "#15781B", "#882020", "#e68f00"];

type EngineLines = Map<number, { pv: string[]; winChance: number }[]>;

/** Only the first PV of each engine votes; secondary lines are not agreement. */
export function getEngineAgreements(arrows: EngineLines) {
    const votes = new Map<string, { orig: string; dest: string; colors: string[] }>();
    for (const [engineIndex, lines] of arrows) {
        if (engineIndex < 0 || engineIndex >= engineColors.length) continue;
        const move = lines[0]?.pv[0];
        const parsed = move && parseUci(move);
        if (!move || !parsed || !("from" in parsed)) continue;
        const orig = makeSquare(parsed.from);
        const dest = makeSquare(parsed.to);
        if (!orig || !dest) continue;
        const vote = votes.get(move) ?? { orig, dest, colors: [] };
        vote.colors.push(engineColors[engineIndex]);
        votes.set(move, vote);
    }
    return [...votes.entries()]
        .filter(([, vote]) => vote.colors.length > 1)
        .map(([move, vote]) => ({ move, ...vote }));
}

/** Chessground's customSvg is anchored at the origin square (100 SVG units). */
export function agreementArrowShape(
    orig: string,
    dest: string,
    colors: string[],
    orientation: "white" | "black",
    boardId: string,
): DrawShape {
    const direction = orientation === "white" ? 1 : -1;
    const dx = (dest.charCodeAt(0) - orig.charCodeAt(0)) * direction;
    const dy = (Number(orig[1]) - Number(dest[1])) * direction;
    const length = Math.hypot(dx, dy) * 100;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const tip = 50 + length - 20;
    const shoulder = tip - 30;
    const clipId = `engine-agreement-${boardId}-${orig}-${dest}`;
    const shaftStripes = colors
        .map((color, index) => {
            const y = 43 + (14 * index) / colors.length;
            return `<rect x="70" y="${y}" width="${shoulder - 70}" height="${14 / colors.length}" fill="${color}"/>`;
        })
        .join("");
    const headStripes = colors
        .map((color, index) => {
            const y = 31 + (38 * index) / colors.length;
            return `<rect x="${shoulder}" y="${y}" width="${tip - shoulder}" height="${38 / colors.length}" fill="${color}"/>`;
        })
        .join("");
    const head = `M${shoulder} 31 L${tip} 50 L${shoulder} 69 Z`;
    return {
        orig: orig as DrawShape["orig"],
        dest: dest as DrawShape["dest"],
        below: true,
        customSvg: {
            html: `<g transform="rotate(${angle} 50 50)" opacity="0.8"><defs><clipPath id="${clipId}"><path d="${head}"/></clipPath></defs>${shaftStripes}<g clip-path="url(#${clipId})">${headStripes}</g></g>`,
        },
    };
}
