import {
    formatScore,
    getAccuracy,
    getAnnotation,
    getCPLoss,
    getWinChance,
} from "../score";
import { test, expect } from "vitest";

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

test("should annotate as ??", () => {
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: -500 }, "w", [])).toBe("??");
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: 500 }, "b", [])).toBe("??");
});

test("should annotate as ?", () => {
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: -200 }, "w", [])).toBe("?");
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: 200 }, "b", [])).toBe("?");
});

test("should annotate as ?!", () => {
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: -100 }, "w", [])).toBe("?!");
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: 100 }, "b", [])).toBe("?!");
});

test("should not annotate", () => {
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: -50 }, "w", [])).toBe("");
    expect(getAnnotation({ type: "cp", value: 0 }, { type: "cp", value: 50 }, "b", [])).toBe("");
});