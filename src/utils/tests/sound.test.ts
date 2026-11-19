import { describe, expect, test } from "vitest";
import { getSoundType } from "../sound";

describe("getSoundType", () => {
    test("plays castle sounds before move variants", () => {
        expect(getSoundType(false, false, true)).toBe("Castles");
    });

    test("plays check sounds for checks", () => {
        expect(getSoundType(false, true)).toBe("Check");
    });

    test("plays checkmate sounds before check and move variants", () => {
        expect(getSoundType(true, true, true, true)).toBe("Checkmate");
    });

    test("plays checkmate sound for checkmate", () => {
        expect(getSoundType(false, true, false, true)).toBe("Checkmate");
    });

    test("plays capture sounds for captures", () => {
        expect(getSoundType(true, false)).toBe("Capture");
    });

    test("plays move sounds for ordinary moves", () => {
        expect(getSoundType(false, false)).toBe("Move");
    });
});
