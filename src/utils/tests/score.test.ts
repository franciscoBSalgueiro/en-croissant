import {
    formatScore,
    getAccuracy,
    getCPLoss,
    getWinChance,
    parseScore,
} from "../score";
import { test } from "uvu";
import assert from "./assert";

test("should parse a cp score correctly", () => {
    assert.equal(parseScore("0.50"), { type: "cp", value: 50 });
    assert.equal(parseScore("-0.50"), { type: "cp", value: -50 });
});

test("should parse a mate score correctly", () => {
    assert.equal(parseScore("M5"), { type: "mate", value: 5 });
    assert.equal(parseScore("-M5"), { type: "mate", value: -5 });
});

test("should format a positive cp score correctly", () => {
    assert.equal(formatScore({ type: "cp", value: 50 }), "+0.50");
});

test("should format a negative cp score correctly", () => {
    assert.equal(formatScore({ type: "cp", value: -50 }), "-0.50");
});

test("should format a mate score correctly", () => {
    assert.equal(formatScore({ type: "mate", value: 5 }), "+M5");
    assert.equal(formatScore({ type: "mate", value: -5 }), "-M5");
});

test("should calculate the win chance correctly", () => {
    assert.equal(getWinChance(0), 50);
    assert.close(getWinChance(100), 59.1);
    assert.close(getWinChance(-500), 13.69);
});

test("should calculate the accuracy correctly", () => {
    assert.equal(
        getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: 0 }, "w"),
        100
    );
    assert.close(
        getAccuracy({ type: "cp", value: 0 }, { type: "cp", value: -500 }, "w"),
        19.06
    );
});

test("should calculate the cp loss correctly", () => {
    assert.equal(
        getCPLoss({ type: "cp", value: 0 }, { type: "cp", value: 50 }, "b"),
        50
    );
    assert.equal(
        getCPLoss({ type: "mate", value: -1 }, { type: "cp", value: 0 }, "b"),
        1000
    );
});

test.run();
