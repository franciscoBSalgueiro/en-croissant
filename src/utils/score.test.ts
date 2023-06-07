import {
    formatScore,
    getAccuracy,
    getCPLoss,
    getWinChance,
    parseScore,
} from "./score";

describe("parseScore", () => {
    it("should parse a cp score correctly", () => {
        expect(parseScore("0.50")).toEqual({ type: "cp", value: 50 });
        expect(parseScore("-0.50")).toEqual({ type: "cp", value: -50 });
    });

    it("should parse a mate score correctly", () => {
        expect(parseScore("M5")).toEqual({ type: "mate", value: 5 });
        expect(parseScore("-M5")).toEqual({ type: "mate", value: -5 });

        expect(parseScore("#5")).toEqual({ type: "mate", value: 5 });
        expect(parseScore("#-5")).toEqual({ type: "mate", value: -5 });
    });
});

describe("formatScore", () => {
    it("should format a positive cp score correctly", () => {
        expect(formatScore({ type: "cp", value: 50 })).toEqual("+0.50");
    });

    it("should format a negative cp score correctly", () => {
        expect(formatScore({ type: "cp", value: -50 })).toEqual("-0.50");
    });

    it("should format a mate score correctly", () => {
        expect(formatScore({ type: "mate", value: 5 })).toEqual("+M5");
        expect(formatScore({ type: "mate", value: -5 })).toEqual("-M5");
    });
});

describe("getWinChance", () => {
    it("should calculate the win chance correctly", () => {
        expect(getWinChance(0)).toEqual(50);
        expect(getWinChance(100)).toBeCloseTo(59.1);
        expect(getWinChance(-500)).toBeCloseTo(13.69);
    });
});

describe("getAccuracy", () => {
    it("should calculate the accuracy correctly", () => {
        expect(
            getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: 0 }, "w")
        ).toBeCloseTo(100);
        expect(
            getAccuracy(
                { type: "cp", value: 0 },
                { type: "cp", value: -500 },
                "w"
            )
        ).toBeCloseTo(19.06, 1);
    });
});

describe("getCPLoss", () => {
    it("should calculate the centipawn loss correctly", () => {
        expect(
            getCPLoss({ type: "cp", value: 0 }, { type: "cp", value: 50 }, "b")
        ).toEqual(50);
        expect(
            getCPLoss(
                { type: "mate", value: -1 },
                { type: "cp", value: 0 },
                "b"
            )
        ).toEqual(1000);
    });
});
