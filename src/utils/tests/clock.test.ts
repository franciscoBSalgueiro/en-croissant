import { parseUci } from "chessops";
import { expect, test } from "vitest";
import { positionFromFen } from "../chessops";
import { getClockInfo } from "../clock";
import { createNode, defaultTree } from "../treeReducer";

function clockFixture() {
    const tree = defaultTree();
    const e4 = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 1,
        clock: 598_200,
    });
    const e5 = createNode({
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        move: parseUci("e7e5")!,
        san: "e5",
        halfMoves: 2,
        clock: 598_500,
    });
    tree.root.children.push(e4);
    e4.children.push(e5);
    return {
        headers: tree.headers,
        root: tree.root,
        currentClock: e5.clock,
        pos: positionFromFen(e5.fen)[0],
        position: [0, 0],
    };
}

test.each(["-", "?", "unknown", undefined])(
    "clock annotations remain usable with TimeControl %s",
    (timeControl) => {
        const input = clockFixture();
        input.headers.time_control = timeControl;

        const clocks = getClockInfo(input);

        expect(clocks.white).toEqual({ value: 598.2, progress: 1 });
        expect(clocks.black).toEqual({ value: 598.5, progress: 598.5 / 598.2 });
    },
);

test("an untimed game's first clock annotation does not invent an opponent clock", () => {
    const input = clockFixture();
    const firstMove = input.root.children[0];
    input.headers.time_control = "-";

    const clocks = getClockInfo({
        ...input,
        currentClock: firstMove.clock,
        pos: positionFromFen(firstMove.fen)[0],
        position: [0],
    });

    expect(clocks.white).toEqual({ value: 598.2, progress: 1 });
    expect(clocks.black).toEqual({ value: undefined, progress: 0 });
});

test("unknown time controls without a reference clock use zero progress", () => {
    const input = clockFixture();
    input.headers.time_control = "?";
    input.root.children[0].clock = undefined;

    expect(getClockInfo(input).black).toEqual({ value: 598.5, progress: 0 });
});

test.each([
    ["600+2", 600],
    ["40/7200:3600", 7200],
] as const)(
    "known time control %s retains its initial-time denominator",
    (timeControl, seconds) => {
        const input = clockFixture();
        input.headers.time_control = timeControl;

        const clocks = getClockInfo(input);

        expect(clocks.white).toEqual({ value: 598.2, progress: 598.2 / seconds });
        expect(clocks.black).toEqual({ value: 598.5, progress: 598.5 / seconds });
    },
);

test("per-player time controls still override an unknown shared control", () => {
    const input = clockFixture();
    input.headers.time_control = "-";
    input.headers.white_time_control = "600+2";
    input.headers.black_time_control = "900+5";

    const clocks = getClockInfo(input);

    expect(clocks.white).toEqual({ value: 598.2, progress: 598.2 / 600 });
    expect(clocks.black).toEqual({ value: 598.5, progress: 598.5 / 900 });
});
