import { expect, test } from "vitest";
import {
  formatScore,
  getAccuracy,
  getAnnotation,
  getChessComClassification,
  getCPLoss,
  getWinChance,
} from "../score";

test("should format a positive cp score correctly", () => {
  expect(formatScore({ type: "cp", value: 50 })).toBe("+0.50");
});

test("should format a negative cp score correctly", () => {
  expect(formatScore({ type: "cp", value: -50 })).toBe("-0.50");
});

test("should format a mate score correctly", () => {
  expect(formatScore({ type: "mate", value: 5 })).toBe("+M5");
  expect(formatScore({ type: "mate", value: -5 })).toBe("-M5");
});

test("should calculate the win chance correctly", () => {
  expect(getWinChance(0)).toBe(50);
  expect(getWinChance(100)).toBeCloseTo(59.1);
  expect(getWinChance(-500)).toBeCloseTo(13.69);
});

test("should calculate the accuracy correctly", () => {
  expect(
    getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: 0 }, "white"),
  ).toBe(100);
  expect(
    getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: -500 }, "white"),
  ).toBeCloseTo(19.07);
});

test("should calculate the cp loss correctly", () => {
  expect(
    getCPLoss({ type: "cp", value: 0 }, { type: "cp", value: 50 }, "black"),
  ).toBe(50);
  expect(
    getCPLoss({ type: "mate", value: -1 }, { type: "cp", value: 0 }, "black"),
  ).toBe(1000);
});

test("should annotate as ??", () => {
  expect(
    getAnnotation(null, null, { type: "cp", value: -500 }, "white", []),
  ).toBe("??");
  expect(
    getAnnotation(null, null, { type: "cp", value: 500 }, "black", []),
  ).toBe("??");
});

test("should annotate as ?", () => {
  expect(
    getAnnotation(null, null, { type: "cp", value: -200 }, "white", []),
  ).toBe("?");
  expect(
    getAnnotation(null, null, { type: "cp", value: 200 }, "black", []),
  ).toBe("?");
});

test("should annotate as ?!", () => {
  expect(
    getAnnotation(null, null, { type: "cp", value: -100 }, "white", []),
  ).toBe("?!");
  expect(
    getAnnotation(null, null, { type: "cp", value: 100 }, "black", []),
  ).toBe("?!");
});

test("should not annotate", () => {
  expect(
    getAnnotation(null, null, { type: "cp", value: -50 }, "white", []),
  ).toBe("");
  expect(
    getAnnotation(null, null, { type: "cp", value: 50 }, "black", []),
  ).toBe("");
});

test("should classify as best move when isBestMove is true", () => {
  expect(getChessComClassification(0, true)).toBe("best");
  expect(getChessComClassification(100, true)).toBe("best");
});

test("should classify as blunder for cpLoss > 200", () => {
  expect(getChessComClassification(201, false)).toBe("blunder");
  expect(getChessComClassification(500, false)).toBe("blunder");
});

test("should classify as mistake for cpLoss > 100 and <= 200", () => {
  expect(getChessComClassification(101, false)).toBe("mistake");
  expect(getChessComClassification(200, false)).toBe("mistake");
});

test("should classify as inaccuracy for cpLoss > 50 and <= 100", () => {
  expect(getChessComClassification(51, false)).toBe("inaccuracy");
  expect(getChessComClassification(100, false)).toBe("inaccuracy");
});

test("should classify as excellent for cpLoss < 20", () => {
  expect(getChessComClassification(0, false)).toBe("excellent");
  expect(getChessComClassification(19, false)).toBe("excellent");
});

test("should classify as good for cpLoss between 20 and 50", () => {
  expect(getChessComClassification(20, false)).toBe("good");
  expect(getChessComClassification(50, false)).toBe("good");
});
