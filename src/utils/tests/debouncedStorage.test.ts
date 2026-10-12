import { expect, test } from "vitest";
import { deserializeStorageValue, serializeStorageValue } from "../../state/store/debouncedStorage";

test("serialize/deserialize round-trips a storage value losslessly", () => {
    const value = {
        version: 0,
        state: {
            root: {
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                children: [],
                comment: "line one\nline two",
                annotations: ["!", "?"],
                shapes: [{ orig: "e2", dest: "e4", brush: "green" }],
                score: { type: "cp", value: { type: "cp", value: 123 } },
            },
            headers: { start: [0, 1], orientation: "white" },
            position: [0, 0],
        },
    };

    const restored = deserializeStorageValue(serializeStorageValue(value));

    expect(restored).toEqual(value);
});

test("compressed payload is smaller than raw JSON for a large tree", () => {
    const big = {
        state: {
            root: {
                children: Array.from({ length: 3000 }, (_, i) => ({
                    fen: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${i}`,
                    san: "e4",
                    comment: "",
                })),
            },
        },
    };

    const raw = JSON.stringify(big);
    const compressed = serializeStorageValue(big);

    expect(compressed.length).toBeLessThan(raw.length);
});

test("deserialize returns null for empty or corrupt input instead of throwing", () => {
    expect(deserializeStorageValue("")).toBeNull();
    expect(deserializeStorageValue("not-valid-lz-data")).toBeNull();
});
