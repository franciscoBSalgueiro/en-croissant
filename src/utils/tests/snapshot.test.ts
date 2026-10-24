import { afterEach, expect, test, vi } from "vitest";
import { svgToPngBlob } from "../snapshot";

// jsdom doesn't decode images
HTMLImageElement.prototype.decode = () => Promise.resolve();

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// A stand-in for WebKit's canvas: a PNG or JPEG board inside the snapshot's SVG starts
// loading the first time the SVG is drawn, and only appears in draws made after it loaded.
// The PNG records what the canvas shows when it's taken, the canvas size and the size the
// snapshot was last drawn at.
function webkitLikeCanvas(boardLoadMs: number) {
    let loadStarted = false;
    let boardLoaded = false;
    let shown = "";
    let drawnSize = "";
    const context = {
        drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => {
            if (!loadStarted) {
                loadStarted = true;
                setTimeout(() => {
                    boardLoaded = true;
                }, boardLoadMs);
            }
            shown = boardLoaded ? "pieces and board" : "pieces";
            drawnSize = `${width}x${height}`;
        },
        clearRect: () => {
            shown = "";
        },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
        this: HTMLCanvasElement,
        callback,
    ) {
        const canvasSize = `${this.width}x${this.height}`;
        callback(new Blob([JSON.stringify({ shown, canvasSize, drawnSize })]));
    });
}

async function takePng(width: number, height: number) {
    const png = svgToPngBlob("data:image/svg+xml,", width, height);
    await vi.runAllTimersAsync();
    return JSON.parse(await (await png)!.text());
}

test("a snapshot keeps a board image that WebKit only loads once the snapshot is drawn", async () => {
    vi.useFakeTimers();
    // The slowest load seen in WebKit for the largest board image at 800px
    webkitLikeCanvas(50);

    // A single draw would give "pieces": the board would be transparent
    expect((await takePng(800, 800)).shown).toBe("pieces and board");
});

test("a snapshot is at least twice the board's size, so it stays sharp on Retina screens even when taken on a 1x screen", async () => {
    vi.useFakeTimers();
    webkitLikeCanvas(0);

    vi.stubGlobal("devicePixelRatio", 1);
    // Filled edge to edge, not drawn at 800x800 in one corner
    expect(await takePng(800, 800)).toMatchObject({
        canvasSize: "1600x1600",
        drawnSize: "1600x1600",
    });

    // A denser screen (Windows at 300%) gets its own density
    vi.stubGlobal("devicePixelRatio", 3);
    expect(await takePng(800, 800)).toMatchObject({
        canvasSize: "2400x2400",
        drawnSize: "2400x2400",
    });
});
