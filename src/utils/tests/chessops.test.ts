import { IllegalSetup, PositionError, parseSquare } from "chessops";
import { FenError, InvalidFen, parseFen } from "chessops/fen";
import { expect, test } from "vitest";
import en_US from "@/translation/en-US.json";
import { chessopsError, getCastlingSquare } from "../chessops";

test("should get the correct castling square in the starting position", () => {
    const setup = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 1", () => {
    const setup = parseFen("bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("f8"));
});

test("should get the correct castling square in FRC 500", () => {
    const setup = parseFen("brqnknrb/pppppppp/8/8/8/8/PPPPPPPP/BRQNKNRB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("g1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("b1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("g8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("b8"));
});

test("should get the correct castling square in FRC 600", () => {
    const setup = parseFen("rqbnkrnb/pppppppp/8/8/8/8/PPPPPPPP/RQBNKRNB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("f8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 608", () => {
    const setup = parseFen("rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w EAea - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("e1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("e8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("every invalid FEN or position has an English message, so none is shown as a raw key", () => {
    // chessopsError returns translation keys, and a key with no translation is shown as the key
    // itself (Errors.InvalidHalfmoves was, while the file spelled it InvalidHaldmoves). Other
    // languages fall back to English, so English needs every one
    const errors = [
        ...Object.values(InvalidFen).map((message) => new FenError(message)),
        ...Object.values(IllegalSetup).map((message) => new PositionError(message)),
    ];
    const translations: Record<string, string> = en_US.translation;
    const untranslated = errors.map(chessopsError).filter((key) => !translations[key]);
    expect(untranslated).toEqual([]);
});
