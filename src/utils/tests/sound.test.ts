import { afterEach, beforeEach, expect, test, vi } from "vitest";

const os = vi.hoisted(() => ({ name: "macos" }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => os.name }));
vi.mock("@tauri-apps/api/path", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tauri-apps/api/path")>()),
    resolveResource: async (path: string) => `/resources/${path}`,
}));
vi.mock("@tauri-apps/api/core", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tauri-apps/api/core")>()),
    convertFileSrc: (path: string) => `asset://localhost${path}`,
}));

const url = (set: string, type: string) => `asset://localhost/resources/sound/${set}/${type}.mp3`;

// A stand-in for the audio engine: records what was decoded and played, and at what volume
let played: { file: string; volume: number }[] = [];
let contextsCreated = 0;
class FakeAudioContext {
    state = "running";
    destination = {};
    constructor() {
        contextsCreated++;
    }
    resume = async () => {};
    decodeAudioData = async (data: ArrayBuffer) => ({ file: new TextDecoder().decode(data) });
    createGain() {
        return { gain: { value: 1 }, connect: () => {} };
    }
    createBufferSource() {
        let gain = { gain: { value: 1 } };
        const source = {
            buffer: null as { file: string } | null,
            connect: (node: typeof gain) => {
                gain = node;
            },
            start: () => played.push({ file: source.buffer!.file, volume: gain.gain.value }),
        };
        return source;
    }
}
// Each sound file's content is its URL, so a decoded sound says which file it came from
const fetchMock = vi.fn<(file: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>>(
    async (file) => ({
        arrayBuffer: async () => new TextEncoder().encode(file).buffer as ArrayBuffer,
    }),
);

beforeEach(() => {
    os.name = "macos";
    played = [];
    contextsCreated = 0;
    fetchMock.mockClear();
    localStorage.clear();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

// The sound module keeps its loaded sounds, so each test starts from a fresh one
async function freshSound(set = "standard", volume = 0.8) {
    vi.resetModules();
    const sound = await import("../sound");
    const { getDefaultStore } = await import("jotai");
    const { soundCollectionAtom, soundVolumeAtom } = await import("@/state/atoms");
    getDefaultStore().set(soundCollectionAtom, set);
    getDefaultStore().set(soundVolumeAtom, volume);
    return sound;
}

// The next move, a moment later (sounds closer than 75 ms apart are skipped)
async function later(ms = 100) {
    vi.setSystemTime(Date.now() + ms);
    await new Promise((resolve) => setTimeout(resolve, 0));
}

test("stepping through moves loads each sound once and plays the rest from memory", async () => {
    const { playSound } = await freshSound();

    for (const capture of [false, true, false, false, true, false]) {
        playSound(capture, false);
        await later();
    }

    expect(played.map((sound) => sound.file)).toEqual(
        [false, true, false, false, true, false].map((capture) =>
            url("standard", capture ? "Capture" : "Move"),
        ),
    );
    // Loading the file again for every move is what made stepping forward lag
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a board preloads its sound set, so even the first move and capture play from memory", async () => {
    const { preloadSounds, playSound } = await freshSound("nes");

    preloadSounds("nes");
    await later();
    expect(fetchMock.mock.calls.map(([file]) => file)).toEqual([
        url("nes", "Move"),
        url("nes", "Capture"),
        url("nes", "Check"),
    ]);

    playSound(true, false);
    await later();
    playSound(false, true);
    await later();

    expect(played.map((sound) => sound.file)).toEqual([url("nes", "Capture"), url("nes", "Check")]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("the standard set has no check sound, so it isn't loaded and a check plays the move sound", async () => {
    const { preloadSounds, playSound } = await freshSound("standard");

    preloadSounds("standard");
    await later();
    playSound(false, true);
    await later();

    expect(fetchMock.mock.calls.map(([file]) => file)).toEqual([
        url("standard", "Move"),
        url("standard", "Capture"),
    ]);
    expect(played.map((sound) => sound.file)).toEqual([url("standard", "Move")]);
});

test("each sound plays at the chosen volume", async () => {
    const { playSound } = await freshSound("standard", 0.3);

    playSound(false, false);
    await later();

    expect(played).toEqual([{ file: url("standard", "Move"), volume: 0.3 }]);
});

test("sounds less than 75 ms apart are skipped", async () => {
    const { playSound } = await freshSound();

    playSound(false, false);
    await later(50);
    playSound(true, false);
    await later(50);

    expect(played.map((sound) => sound.file)).toEqual([url("standard", "Move")]);
});

test("a sound that failed to load is loaded again the next time", async () => {
    const { playSound } = await freshSound();
    fetchMock.mockRejectedValueOnce(new Error("not found"));

    playSound(false, false);
    await later();
    playSound(false, false);
    await later();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(played.map((sound) => sound.file)).toEqual([url("standard", "Move")]);
});

test("Linux keeps its own sound server: no sound is loaded this way there", async () => {
    os.name = "linux";
    const { preloadSounds, playSound } = await freshSound();

    preloadSounds("standard");
    playSound(false, false);
    await later();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(contextsCreated).toBe(0);
});
