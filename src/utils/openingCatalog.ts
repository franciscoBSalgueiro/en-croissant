import { ChildNode, makePgn, Node, type PgnNodeData } from "chessops/pgn";
import a from "@/data/chess-openings/a.tsv?raw";
import b from "@/data/chess-openings/b.tsv?raw";
import c from "@/data/chess-openings/c.tsv?raw";
import d from "@/data/chess-openings/d.tsv?raw";
import e from "@/data/chess-openings/e.tsv?raw";

export interface CatalogOpening {
    id: string;
    eco: string;
    name: string;
    pgn: string;
    moves: string[];
}

export const openingLines: CatalogOpening[] = [a, b, c, d, e].flatMap((tsv) =>
    tsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => {
            const [eco, name, pgn] = row.split("\t");
            return {
                id: `${eco}:${name}:${pgn}`,
                eco,
                name,
                pgn,
                moves: pgn
                    .replace(/\d+\.(?:\.\.)?/g, " ")
                    .trim()
                    .split(/\s+/),
            };
        }),
);

// A name can have several transpositions. Show its shortest named line once
// in the picker, retaining all source lines for optional continuations.
const namedOpenings = new Map<string, CatalogOpening>();
for (const opening of openingLines) {
    const key = `${opening.eco}:${opening.name}`;
    const previous = namedOpenings.get(key);
    if (!previous || opening.moves.length < previous.moves.length) namedOpenings.set(key, opening);
}
export const openingCatalog = [...namedOpenings.values()].sort(
    (a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
);

export function openingContinuations(opening: CatalogOpening): CatalogOpening[] {
    return [
        opening,
        ...openingCatalog.filter(
            (candidate) =>
                candidate.id !== opening.id &&
                candidate.moves.length > opening.moves.length &&
                opening.moves.every((move, index) => candidate.moves[index] === move),
        ),
    ];
}

export function openingRepertoirePgn({
    name,
    color,
    opening,
    includeContinuations,
}: {
    name: string;
    color: "white" | "black";
    opening: CatalogOpening;
    includeContinuations: boolean;
}) {
    const lines = includeContinuations ? openingContinuations(opening) : [opening];
    const moves = new Node<PgnNodeData>();
    for (const line of lines) {
        let node = moves;
        for (const san of line.moves) {
            let child = node.children.find((candidate) => candidate.data.san === san);
            if (!child) {
                child = new ChildNode<PgnNodeData>({ san });
                node.children.push(child);
            }
            node = child;
        }
        if (node !== moves) {
            const end = node as ChildNode<PgnNodeData>;
            end.data.comments ??= [];
            if (!end.data.comments.includes(line.name)) end.data.comments.push(line.name);
        }
    }
    return makePgn({
        headers: new Map([
            ["Event", name],
            ["Site", "https://github.com/lichess-org/chess-openings"],
            ["White", "?"],
            ["Black", "?"],
            ["Result", "*"],
            ["Orientation", color],
            ["ECO", opening.eco],
            ["Opening", opening.name],
        ]),
        moves,
    });
}

export function openingRepertoireName(opening: CatalogOpening) {
    return opening.name
        .replace(/[<>:"/\\|?*]/g, " - ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}
