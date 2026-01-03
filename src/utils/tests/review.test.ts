import { describe, expect, test } from "vitest";
import { REVIEW_INFO, type ReviewClassification } from "../annotation";
import { getCPLoss, getChessComClassification } from "../score";

describe("REVIEW_INFO", () => {
  test("should have all review classifications defined", () => {
    const classifications: ReviewClassification[] = [
      "best",
      "excellent",
      "good",
      "inaccuracy",
      "mistake",
      "blunder",
      "book",
      "forced",
    ];

    for (const classification of classifications) {
      expect(REVIEW_INFO[classification]).toBeDefined();
      expect(REVIEW_INFO[classification].name).toBeDefined();
      expect(REVIEW_INFO[classification].translationKey).toBeDefined();
      expect(REVIEW_INFO[classification].color).toBeDefined();
      expect(REVIEW_INFO[classification].symbol).toBeDefined();
    }
  });

  test("should have correct colours for mistake types", () => {
    expect(REVIEW_INFO.blunder.color).toBe("red");
    expect(REVIEW_INFO.mistake.color).toBe("orange");
    expect(REVIEW_INFO.inaccuracy.color).toBe("yellow");
  });

  test("should have correct colours for good move types", () => {
    expect(REVIEW_INFO.best.color).toBe("green");
    expect(REVIEW_INFO.excellent.color).toBe("teal");
    expect(REVIEW_INFO.good.color).toBe("lime");
  });
});

describe("Review classification thresholds", () => {
  test("should classify moves correctly based on centipawn loss", () => {
    const testCases: { cpLoss: number; isBest: boolean; expected: ReviewClassification }[] = [
      { cpLoss: 0, isBest: true, expected: "best" },
      { cpLoss: 0, isBest: false, expected: "excellent" },
      { cpLoss: 10, isBest: false, expected: "excellent" },
      { cpLoss: 19, isBest: false, expected: "excellent" },
      { cpLoss: 20, isBest: false, expected: "good" },
      { cpLoss: 50, isBest: false, expected: "good" },
      { cpLoss: 51, isBest: false, expected: "inaccuracy" },
      { cpLoss: 100, isBest: false, expected: "inaccuracy" },
      { cpLoss: 101, isBest: false, expected: "mistake" },
      { cpLoss: 200, isBest: false, expected: "mistake" },
      { cpLoss: 201, isBest: false, expected: "blunder" },
      { cpLoss: 500, isBest: false, expected: "blunder" },
    ];

    for (const { cpLoss, isBest, expected } of testCases) {
      expect(getChessComClassification(cpLoss, isBest)).toBe(expected);
    }
  });

  test("best move flag should override cpLoss classification", () => {
    expect(getChessComClassification(0, true)).toBe("best");
    expect(getChessComClassification(50, true)).toBe("best");
    expect(getChessComClassification(100, true)).toBe("best");
    expect(getChessComClassification(300, true)).toBe("best");
  });
});

describe("getCPLoss for review", () => {
  test("should calculate cp loss for white moves correctly", () => {
    const prev = { type: "cp" as const, value: 100 };
    const next = { type: "cp" as const, value: 50 };
    expect(getCPLoss(prev, next, "white")).toBe(50);
  });

  test("should calculate cp loss for black moves correctly", () => {
    const prev = { type: "cp" as const, value: -100 };
    const next = { type: "cp" as const, value: -50 };
    expect(getCPLoss(prev, next, "black")).toBe(50);
  });

  test("should return 0 when move improves position", () => {
    const prev = { type: "cp" as const, value: 0 };
    const next = { type: "cp" as const, value: 100 };
    expect(getCPLoss(prev, next, "white")).toBe(0);
  });

  test("should handle mate scores", () => {
    const prev = { type: "mate" as const, value: 3 };
    const next = { type: "cp" as const, value: 500 };
    expect(getCPLoss(prev, next, "white")).toBe(500);
  });
});

describe("Review accuracy calculation", () => {
  test("accuracy formula should return 100 for 0 average CPL", () => {
    const averageCPL = 0;
    const accuracy = Math.max(
      0,
      Math.min(100, 103.1668 * Math.exp(-0.04354 * averageCPL) - 3.1669 + 1),
    );
    expect(accuracy).toBeCloseTo(100, 0);
  });

  test("accuracy formula should return lower values for higher CPL", () => {
    const lowCPL = 10;
    const highCPL = 50;

    const lowAccuracy = Math.max(
      0,
      Math.min(100, 103.1668 * Math.exp(-0.04354 * lowCPL) - 3.1669 + 1),
    );
    const highAccuracy = Math.max(
      0,
      Math.min(100, 103.1668 * Math.exp(-0.04354 * highCPL) - 3.1669 + 1),
    );

    expect(lowAccuracy).toBeGreaterThan(highAccuracy);
  });

  test("accuracy should be clamped between 0 and 100", () => {
    const extremeCPL = 1000;
    const accuracy = Math.max(
      0,
      Math.min(100, 103.1668 * Math.exp(-0.04354 * extremeCPL) - 3.1669 + 1),
    );

    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });
});

