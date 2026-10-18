import { Chess } from "chessops/chess";
import { parseSan } from "chessops/san";
import { expect, test, vi } from "vitest";
import { commands } from "@/bindings";
import { ANNOTATION_INFO, type Annotation, NAG_INFO } from "../annotation";
import { cleanPgnInvisibleCharacters, hasMorePriority, headersToPGN, parsePGN } from "../chess";

vi.mock("@/bindings", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/bindings")>();
    return {
        ...original,
        commands: {
            ...original.commands,
            lexPgn: vi.fn<typeof original.commands.lexPgn>(async () => ({
                status: "ok",
                data: [],
            })),
        },
    };
});

test("NAGs are consistent", () => {
    for (const k of Object.keys(ANNOTATION_INFO)) {
        if (k === "") continue;
        const nag = ANNOTATION_INFO[k as Annotation].nag!;
        expect(NAG_INFO.get(`$${nag}`)).toBe(k);
    }
});

test("priority comparison", () => {
    expect(hasMorePriority([0, 0], [0])).toBe(false);
    expect(hasMorePriority([0], [0, 0])).toBe(true);
    expect(hasMorePriority([0], [1])).toBe(true);
    expect(hasMorePriority([1], [0])).toBe(false);
    expect(hasMorePriority([0, 0], [0, 1])).toBe(true);
    expect(hasMorePriority([0, 1], [0, 0])).toBe(false);
    expect(hasMorePriority([0, 1], [0, 2])).toBe(true);
    expect(hasMorePriority([0, 2], [0, 1])).toBe(false);
});

test("PGN headers preserve UTC time", () => {
    const pgn = headersToPGN({
        id: 1,
        fen: "",
        event: "Live Chess",
        site: "https://www.chess.com/game/live/1",
        date: "2026.09.19",
        time: "12:34:56",
        round: "-",
        white: "White",
        black: "Black",
        result: "1-0",
    });

    expect(pgn).toContain('[UTCTime "12:34:56"]');
});

// The Opera Game (Morphy, Paris 1858)
const OPERA_MOVES =
    "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#".split(
        " ",
    );
const OPERA_PGN = `[Event "Paris"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

${OPERA_MOVES.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(" ")} 1-0
`;

// The moves the PGN reader sees: it separates tokens on plain spaces, tabs and newlines only
function movesAsRead(pgn: string) {
    return pgn
        .slice(pgn.indexOf("\n\n") + 2)
        .split(/[ \t\r\n]+/)
        .filter((token) => token !== "" && !/^\d+\.*$/.test(token) && token !== "1-0");
}

test("a game copied with word joiners around the first move number keeps its first move", () => {
    // How the game arrived through a messaging app; the reader then lost 1.e4, and every move
    // that no longer fitted was skipped, giving a different game
    const copied = OPERA_PGN.replace("1. e4", "1.\u2060 \u2060e4");
    expect(movesAsRead(copied)).not.toContain("e4");

    const cleaned = cleanPgnInvisibleCharacters(copied);

    expect(movesAsRead(cleaned)).toEqual(OPERA_MOVES);
    const pos = Chess.default();
    for (const san of movesAsRead(cleaned)) {
        const move = parseSan(pos, san);
        expect(move).toBeDefined();
        pos.play(move!);
    }
    expect(pos.isCheckmate()).toBe(true);
});

test("invisible characters and look-alike spaces anywhere in the moves are cleaned", () => {
    const copied = `\uFEFF${OPERA_PGN}`
        .replace("1. e4", "\u200F1.\u200E e4") // direction marks, common in right-to-left chats
        .replace("e5 2. Nf3", "e5\u00A02.\u202FNf3") // no-break and narrow no-break spaces
        .replace("d6 3. d4", "d6\u200B 3. d4") // zero-width space
        .replace("Bxf3", "Bx\u00ADf3") // soft hyphen inside a move
        .replace("4. dxe5", "4.\u3000dxe5") // ideographic space
        .replace("Qe6 15.", "Qe6\u202815."); // line separator

    expect(movesAsRead(cleanPgnInvisibleCharacters(copied))).toEqual(OPERA_MOVES);
});

test("look-alike spaces become plain spaces, so the moves they separate stay apart", () => {
    expect(cleanPgnInvisibleCharacters("1. e4\u00A0e5 2.\u2009Nf3")).toBe("1. e4 e5 2. Nf3");
});

test("invisible characters are removed, not turned into spaces, so a move they're inside stays whole", () => {
    expect(cleanPgnInvisibleCharacters("2. N\u2060f3 N\u200Bc6")).toBe("2. Nf3 Nc6");
});

test("comments and header values keep every character", () => {
    const kept = [
        '[Event "The \\"Big\u00A0One\\" { not a comment } ; nor this"]',
        '[White "Ali\u200CReza"]',
        "",
        '1. e4 { Great\u00A0move \u{1F468}\u200D\u{1F469}\u200D\u{1F467} [%clk 0:03:00] "quote" ; } e5',
    ].join("\n");
    const lineComment = "; rest\u00A0of the\u2060line\n2. Nf3 *\n";

    // Only the no-break space between the comment and the line comment is outside them
    expect(cleanPgnInvisibleCharacters(`${kept}\u00A0${lineComment}`)).toBe(
        `${kept} ${lineComment}`,
    );
});

test("an unfinished comment keeps its text", () => {
    const pgn = "1. e4 { unfinished\u00A0comment\u2060";
    expect(cleanPgnInvisibleCharacters(pgn)).toBe(pgn);
});

test("a brace in a header value or a % escape line doesn't start a comment", () => {
    // The reader skips "%" lines and only reads braces as comments outside strings, so the
    // moves after them are still cleaned
    expect(cleanPgnInvisibleCharacters('[Event "a { b"]\n\n1. e4\u00A0e5 *')).toBe(
        '[Event "a { b"]\n\n1. e4 e5 *',
    );
    expect(cleanPgnInvisibleCharacters("% note { not a comment\n1. e4\u00A0e5 *")).toBe(
        "% note { not a comment\n1. e4 e5 *",
    );
});

test("a PGN without invisible characters comes back unchanged", () => {
    const pgn = [
        '[Event "Caf\u00E9 Open \\"A\\" (Round 1)"]',
        '[ White  "Ivanchuk, Vassily" ]',
        '[Black "\u0418\u0432\u0430\u043D\u043E\u0432"]',
        '[Result "1/2-1/2"]',
        "",
        "% an escape line { with a brace",
        "1.\te4  e5 ( 1... c5 2. Nf3 ( 2. c3 ) d6 ) 2. Nf3 $1 Nc6!? { [%clk 0:02:58] [%eval 0.17]",
        "a comment on two lines } 3. Bb5 a6 ; Ruy L\u00F3pez",
        "4. Ba4 Nf6 5. O-O Be7 6. e8=Q+ 1/2-1/2",
        "",
        '[Event "Second game"]',
        "",
        "1. d4 d5 *",
        "",
    ].join("\r\n");

    expect(cleanPgnInvisibleCharacters(pgn)).toBe(pgn);
});

test("opening a game reads the cleaned PGN", async () => {
    await parsePGN(OPERA_PGN.replace("1. e4", "1.\u2060 \u2060e4"));

    expect(commands.lexPgn).toHaveBeenLastCalledWith(OPERA_PGN);
});
