import { exists, readFile, remove } from "@tauri-apps/plugin-fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "@/bindings";
import { isExpectedModel, MODEL, placementFromScores } from "../vision/model";
import { DownloadDeclined, loadModel } from "../vision/reader";

vi.mock("@tauri-apps/api/path", () => ({
    resolve: async (...parts: string[]) => parts.join("/"),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
    exists: vi.fn<typeof exists>(),
    readFile: vi.fn<typeof readFile>(),
    remove: vi.fn<typeof remove>(),
}));
vi.mock("@/utils/directories", () => ({ getVisionDir: async () => "/app-data/vision" }));
vi.mock("@/bindings", () => ({
    commands: { downloadFile: vi.fn<typeof commands.downloadFile>() },
    events: { progressEvent: { listen: async () => () => {} } },
}));

afterEach(() => {
    vi.clearAllMocks();
});

const CLASSES = ".PNBRQKpnbrqk";

// The model's output for a position: 64 squares in the order the model reads them, each with a
// score for every class, the highest for the given piece ("." for empty)
function scoresFor(squares: string, runnerUp: Record<number, string> = {}): Float32Array {
    const scores = new Float32Array(64 * CLASSES.length);
    for (let square = 0; square < 64; square++) {
        scores[square * CLASSES.length + CLASSES.indexOf(squares[square])] = 10;
        const close = runnerUp[square];
        if (close) scores[square * CLASSES.length + CLASSES.indexOf(close)] = 9;
    }
    return scores;
}

describe("placementFromScores", () => {
    test("the model reads the board from a8 to h1, so its first squares are Black's back rank", () => {
        // a8 rook, e8 king, e1 king, h1 rook
        const squares = `r...k...${".".repeat(48)}....K..R`;
        // If the squares were read from a1 instead, White's pieces would end up at the top
        expect(placementFromScores(scoresFor(squares))).toBe("r3k3/8/8/8/8/8/8/4K2R");
    });

    test("each square takes its highest-scoring class, even when another one is close", () => {
        const squares = `....k...${".".repeat(48)}....K...`;
        // e8's king barely beats an empty square, and the empty a1 barely beats a white rook
        const scores = scoresFor(squares, { 4: ".", 56: "R" });
        expect(placementFromScores(scores)).toBe("4k3/8/8/8/8/8/8/4K3");
    });
});

describe("isExpectedModel", () => {
    // A stand-in model: 1,000 bytes and their SHA-256
    const bytes = new Uint8Array(1000).map((_, i) => i % 251);
    async function sha256(data: Uint8Array<ArrayBuffer>) {
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
        return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    test("only the exact pinned file passes: a wrong size or a single changed byte is refused", async () => {
        const expected = { size: bytes.length, sha256: await sha256(bytes) };
        expect(await isExpectedModel(bytes, expected)).toBe(true);
        expect(await isExpectedModel(bytes.slice(0, 999), expected)).toBe(false);
        const tampered = bytes.slice();
        tampered[500] ^= 1;
        expect(await isExpectedModel(tampered, expected)).toBe(false);
    });
});

describe("loadModel", () => {
    const notTheModel = new Uint8Array(10);

    test("a model file on disk that isn't the pinned one is deleted and never used", async () => {
        vi.mocked(exists).mockResolvedValue(true);
        vi.mocked(readFile).mockResolvedValue(notTheModel);
        const confirmDownload = vi.fn<() => Promise<boolean>>();

        await expect(loadModel({ confirmDownload, onDownloadProgress: () => {} })).rejects.toThrow(
            "isn't the expected file",
        );
        expect(remove).toHaveBeenCalledWith(`/app-data/vision/${MODEL.fileName}`);
        expect(confirmDownload).not.toHaveBeenCalled();
    });

    test("nothing is downloaded unless the user agrees", async () => {
        vi.mocked(exists).mockResolvedValue(false);

        await expect(
            loadModel({ confirmDownload: async () => false, onDownloadProgress: () => {} }),
        ).rejects.toBeInstanceOf(DownloadDeclined);
        expect(commands.downloadFile).not.toHaveBeenCalled();
    });

    test("once the user agrees, the model is downloaded from the pinned address and checked like any other", async () => {
        vi.mocked(exists).mockResolvedValue(false);
        vi.mocked(commands.downloadFile).mockResolvedValue({ status: "ok", data: null });
        // The download came back as something else
        vi.mocked(readFile).mockResolvedValue(notTheModel);

        await expect(
            loadModel({ confirmDownload: async () => true, onDownloadProgress: () => {} }),
        ).rejects.toThrow("isn't the expected file");
        expect(commands.downloadFile).toHaveBeenCalledWith(
            "vision_model",
            MODEL.url,
            `/app-data/vision/${MODEL.fileName}`,
            null,
            null,
            MODEL.size,
        );
        expect(remove).toHaveBeenCalledWith(`/app-data/vision/${MODEL.fileName}`);
    });
});
