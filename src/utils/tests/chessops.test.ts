import { parseSquare } from "chessops";
import { parseFen } from "chessops/fen";
import { expect, test } from "vitest";
import { getCastlingSquare } from "../chessops";

test("should get the correct castling square in the starting position", () => {
  const setup = parseFen(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ).unwrap();
  expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
  expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
  expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
  expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 1", () => {
  const setup = parseFen(
    "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1",
  ).unwrap();
  expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
  expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("f1"));
  expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
  expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("f8"));
});

test("should get the correct castling square in FRC 500", () => {
  const setup = parseFen(
    "brqnknrb/pppppppp/8/8/8/8/PPPPPPPP/BRQNKNRB w KQkq - 0 1",
  ).unwrap();
  expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("g1"));
  expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("b1"));
  expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("g8"));
  expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("b8"));
});

test("should get the correct castling square in FRC 600", () => {
  const setup = parseFen(
    "rqbnkrnb/pppppppp/8/8/8/8/PPPPPPPP/RQBNKRNB w KQkq - 0 1",
  ).unwrap();
  expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("f1"));
  expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
  expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("f8"));
  expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 608", () => {
  const setup = parseFen(
    "rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w EAea - 0 1",
  ).unwrap();
  expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("e1"));
  expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
  expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("e8"));
  expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});
