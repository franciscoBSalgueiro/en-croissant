import { Chess } from "chessops/chess";
import { parsePgn, startingPosition, walk } from "chessops/pgn";
import { parseSan } from "chessops/san";
import { describe, expect, it } from "vitest";
import { parseOpeningCatalog, openingContinuations, openingRepertoirePgn } from "../openingCatalog";

import { testCatalog, catalogVolumes } from "./fixtures/openingCatalog";
const { openings: openingCatalog, lines: openingLines } = testCatalog;

const italian = openingCatalog.find((opening) => opening.name === "Italian Game")!;

describe("downloadable opening catalog", () => {
    it("parses unique, legal opening lines across all ECO volumes", () => {
        expect(openingCatalog.length).toBeGreaterThan(4);
        expect(new Set(openingCatalog.map((opening) => opening.id)).size).toBe(
            openingCatalog.length,
        );
        expect(new Set(openingCatalog.map((opening) => opening.eco[0]))).toEqual(
            new Set(["A", "B", "C", "D", "E"]),
        );
        for (const opening of openingLines) {
            const position = Chess.default();
            for (const san of opening.moves) {
                const move = parseSan(position, san);
                expect(move, `${opening.name}: ${san}`).toBeDefined();
                position.play(move!);
            }
        }
    });

    it("creates a single-game repertoire with the selected color and line", () => {
        for (const color of ["white", "black"] as const) {
            const pgn = openingRepertoirePgn({
                name: "My Italian",
                color,
                opening: italian,
                includeContinuations: false,
            });
            const games = parsePgn(pgn);
            expect(games).toHaveLength(1);
            expect(games[0].headers.get("Orientation")).toBe(color);
            expect(games[0].headers.get("ECO")).toBe(italian.eco);
            expect([...games[0].moves.mainline()].map((move) => move.san)).toEqual(italian.moves);
        }
    });

    it("merges only continuations of the selected line into legal branches", () => {
        const lines = openingContinuations(italian, openingLines);
        expect(lines.length).toBeGreaterThan(1);
        expect(
            lines.every((line) => italian.moves.every((move, index) => line.moves[index] === move)),
        ).toBe(true);
        const [game] = parsePgn(
            openingRepertoirePgn({
                name: "Italian variations",
                color: "white",
                opening: italian,
                includeContinuations: true,
                catalogLines: openingLines,
            }),
        );
        for (const line of lines) {
            let node = game.moves;
            for (const san of line.moves) {
                const child = node.children.find((candidate) => candidate.data.san === san);
                expect(child, `${line.name}: ${san}`).toBeDefined();
                node = child!;
            }
        }
        walk(game.moves, startingPosition(game.headers).unwrap(), (position, data) => {
            const move = parseSan(position, data.san);
            expect(move).toBeDefined();
            position.play(move!);
        });
    });
});

it("rejects incomplete catalogs and invalid TSV responses", () => {
    expect(() => parseOpeningCatalog(catalogVolumes.slice(0, 4))).toThrow();
    expect(() => parseOpeningCatalog(["<html>error</html>", ...catalogVolumes.slice(1)])).toThrow();
});
