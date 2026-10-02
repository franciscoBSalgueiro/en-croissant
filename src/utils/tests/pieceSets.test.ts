import { expect, test } from "vitest";
import {
    buildPieceSetCss,
    BUILTIN_PIECE_SETS,
    customPieceSetId,
    customPieceSetName,
    findCssUrlRefs,
    imageFileNameToSlot,
    isBuiltinPieceSet,
    isCustomPieceSetId,
    parsePieceSetCss,
    PIECE_SLOTS,
    sanitizePieceSetCss,
    slugifyPieceSetName,
    slotSelector,
    uniquePieceSetName,
} from "@/utils/pieceSets";

// A stylesheet in the same shape as the bundled piece sets (data URI per slot).
const fullTheme = PIECE_SLOTS.map(
    (slot) => `${slotSelector(slot)} { background-image: url("data:image/svg+xml;base64,AAAA"); }`,
).join("\n");

test("exposes the twelve piece slots and the built-in sets", () => {
    expect(PIECE_SLOTS).toHaveLength(12);
    expect(PIECE_SLOTS).toContain("white.king");
    expect(PIECE_SLOTS).toContain("black.pawn");
    expect(slotSelector("white.knight")).toBe(".knight.white");
    expect(BUILTIN_PIECE_SETS).toHaveLength(30);
    expect(isBuiltinPieceSet("staunty")).toBe(true);
    expect(isBuiltinPieceSet("my-pieces")).toBe(false);
});

test("round trips custom piece set ids", () => {
    const id = customPieceSetId("my-pieces");
    expect(id).toBe("custom/my-pieces");
    expect(isCustomPieceSetId(id)).toBe(true);
    expect(customPieceSetName(id)).toBe("my-pieces");
    expect(isCustomPieceSetId("staunty")).toBe(false);
    expect(isCustomPieceSetId("custom/")).toBe(false);
});

test("parses every slot of a complete stylesheet", () => {
    const info = parsePieceSetCss(fullTheme);
    expect(info.covered).toEqual(PIECE_SLOTS);
    expect(info.missing).toEqual([]);
    expect(info.externalUrls).toEqual([]);
    expect(info.ruleCount).toBe(12);
});

test("reports missing slots of a partial stylesheet", () => {
    const info = parsePieceSetCss(
        ".pawn.white { background-image: url(data:image/png;base64,AA); }",
    );
    expect(info.covered).toEqual(["white.pawn"]);
    expect(info.missing).toHaveLength(11);
});

test("finds rules in nested at-rules and comma separated selectors", () => {
    const css = `
        @media (prefers-color-scheme: dark) {
            .pawn.white, piece.knight.black { background-image: url(data:image/png;base64,AA); }
        }
        /* not a rule: .queen.white { } */
        .rook.white { background-image: url("data:image/svg+xml;base64,BB"); }
    `;
    const info = parsePieceSetCss(css);
    expect(info.covered).toEqual(["white.pawn", "white.rook", "black.knight"]);
});

test("classifies url references", () => {
    const css = `
        .pawn.white { background-image: url("data:image/png;base64,AA"); }
        .pawn.black { background-image: url(knight.svg); }
        .knight.white { background-image: url("https://example.com/a.png"); }
        .knight.black { background-image: url("/abs/b.svg"); }
        .rook.white { background-image: url(#filter); }
    `;
    expect(findCssUrlRefs(css).map((ref) => ref.kind)).toEqual([
        "data",
        "relative",
        "remote",
        "absolute",
        "fragment",
    ]);
    expect(parsePieceSetCss(css).externalUrls).toEqual([
        "knight.svg",
        "https://example.com/a.png",
        "/abs/b.svg",
    ]);
});

test("sanitizes stylesheets before injection", () => {
    const clean = sanitizePieceSetCss(
        '@import url("https://example.com/x.css");\n.pawn.white{background-image:url(</style><script>1</script>data:image/png;base64,AA)}',
    );
    expect(clean.toLowerCase()).not.toContain("@import");
    expect(clean).not.toContain("</style");
    expect(clean).not.toContain("<script");
    expect(clean).toContain("data:image/png;base64,AA");
});

test("builds a stylesheet from encoded images", () => {
    const css = buildPieceSetCss(
        PIECE_SLOTS.map((slot) => ({ slot, dataUri: `data:image/png;base64,${slot}` })),
        "C:/tmp/My Pieces",
    );
    const info = parsePieceSetCss(css);
    expect(info.missing).toEqual([]);
    expect(css).toContain("Source: C:/tmp/My Pieces");
    expect(buildPieceSetCss([]).split("\n")).toHaveLength(2);
});

test("maps piece image file names to slots", () => {
    const cases: Record<string, string | null> = {
        "wK.svg": "white.king",
        "bp.png": "black.pawn",
        "white-knight.svg": "white.knight",
        "white_bishop.png": "white.bishop",
        "black queen.svg": "black.queen",
        "knight-white.svg": "white.knight",
        "rook_black.png": "black.rook",
        "b-n.svg": "black.knight",
        "n-b.svg": "black.knight",
        "w-b.svg": "white.bishop",
        "black-knight@2x.svg": "black.knight",
        "b-b.svg": null,
        "horse.svg": null,
        "wK.txt": null,
        "king.png": null,
    };
    const mapped = Object.fromEntries(
        Object.keys(cases).map((fileName) => [fileName, imageFileNameToSlot(fileName)]),
    );
    expect(mapped).toEqual(cases);
});

test("slugifies and de-duplicates piece set names", () => {
    expect(slugifyPieceSetName("My Pieces.css")).toBe("my-pieces");
    expect(slugifyPieceSetName("  Weird  Name!! ")).toBe("weird-name");
    expect(slugifyPieceSetName("我的棋子")).toBe("");
    expect(uniquePieceSetName("staunty", ["staunty"])).toBe("staunty-2");
    expect(uniquePieceSetName("", [])).toBe("piece-set");
    expect(uniquePieceSetName("x", ["x", "x-2"])).toBe("x-3");
});
