import { ChildNode, makePgn, Node, type PgnNodeData } from "chessops/pgn";

export interface CatalogOpening {
    id: string;
    eco: string;
    name: string;
    pgn: string;
    moves: string[];
}

export interface OpeningCatalog {
    lines: CatalogOpening[];
    openings: CatalogOpening[];
}

export function parseOpeningCatalog(volumes: string[]): OpeningCatalog {
    if (volumes.length !== 5) throw new Error("Incomplete opening catalog");
    const lines = volumes.flatMap((tsv) => {
        const rows = tsv.trim().split(/\r?\n/);
        if (rows.shift() !== "eco\tname\tpgn" || !rows.length)
            throw new Error("Invalid opening catalog");
        return rows.map((row) => {
            const [eco, name, pgn] = row.split("\t");
            if (!/^[A-E]\d{2}$/.test(eco) || !name || !pgn)
                throw new Error("Invalid opening catalog row");
            const moves = pgn
                .replace(/\d+\.(?:\.\.)?/g, " ")
                .trim()
                .split(/\s+/);
            return { id: `${eco}:${name}:${pgn}`, eco, name, pgn, moves };
        });
    });
    const named = new Map<string, CatalogOpening>();
    for (const opening of lines) {
        const key = `${opening.eco}:${opening.name}`;
        const previous = named.get(key);
        if (!previous || opening.moves.length < previous.moves.length) named.set(key, opening);
    }
    const openings = [...named.values()].sort(
        (a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
    );
    return { lines, openings };
}

export function openingContinuations(
    opening: CatalogOpening,
    catalogLines: CatalogOpening[],
): CatalogOpening[] {
    return [
        opening,
        ...catalogLines.filter(
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
    catalogLines = [opening],
}: {
    name: string;
    color: "white" | "black";
    opening: CatalogOpening;
    includeContinuations: boolean;
    catalogLines?: CatalogOpening[];
}) {
    const lines = includeContinuations ? openingContinuations(opening, catalogLines) : [opening];
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
