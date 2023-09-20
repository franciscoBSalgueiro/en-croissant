import {
    formatScore,
    getAccuracy,
    getCPLoss,
    getWinChance,
    parseScore,
} from "../score";
import { test, expect } from "vitest";

test("should parse a cp score correctly", () => {
    expect(parseScore("0.50")).toStrictEqual({ type: "cp", value: 50 });
    expect(parseScore("-0.50")).toStrictEqual({ type: "cp", value: -50 });
});

test("should parse a mate score correctly", () => {
    expect(parseScore("M5")).toStrictEqual({ type: "mate", value: 5 });
    expect(parseScore("-M5")).toStrictEqual({ type: "mate", value: -5 });
});

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
    expect(getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: 0 }, "w")).toBe(100);
    expect(getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: -500 }, "w")).toBeCloseTo(19.07);
});

test("should calculate the cp loss correctly", () => {
    expect(getCPLoss({ type: "cp", value: 0 }, { type: "cp", value: 50 }, "b")).toBe(50);
    expect(getCPLoss({ type: "mate", value: -1 }, { type: "cp", value: 0 }, "b")).toBe(1000);
});
