import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import { getDefaultStore } from "jotai";
import { commands } from "@/bindings/generated";
import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";

const POOL_SIZE = 5;
const audioPool = Array.from({ length: POOL_SIZE }, () => new Audio());
let poolIndex = 0;

let soundServerPort: number | null = null;

// Except on Linux, each sound file is decoded once and then played from memory: loading the
// file again for every move stalls the board when stepping through moves quickly
let audioContext: AudioContext | null = null;
const soundBuffers = new Map<string, Promise<AudioBuffer>>();

function isLinux(): boolean {
    try {
        return platform() === "linux";
    } catch {
        return false;
    }
}

let lastTime = 0;

async function getSoundServerPort(): Promise<number> {
    if (soundServerPort !== null) {
        return soundServerPort;
    }
    const result = await commands.getSoundServerPort();
    if (result.status === "ok") {
        soundServerPort = result.data;
        return soundServerPort;
    }
    throw new Error("Failed to get sound server port");
}

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

function loadSound(collection: string, type: string): Promise<AudioBuffer> {
    const key = `${collection}/${type}`;
    let sound = soundBuffers.get(key);
    if (!sound) {
        sound = resolveResource(`sound/${key}.mp3`)
            .then((filePath) => fetch(convertFileSrc(filePath)))
            .then((response) => response.arrayBuffer())
            .then((data) => getAudioContext().decodeAudioData(data));
        soundBuffers.set(key, sound);
        // Try again next time if it failed
        sound.catch(() => soundBuffers.delete(key));
    }
    return sound;
}

function playBuffer(buffer: AudioBuffer, volume: number) {
    const context = getAudioContext();
    // A context created before any click or key press can start suspended
    if (context.state === "suspended") {
        context.resume().catch((e) => console.error("Audio playback error:", e));
    }
    const gain = context.createGain();
    gain.gain.value = volume;
    gain.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
}

// Loads a sound set before its first sound is needed, so the first moves aren't late
export function preloadSounds(collection: string) {
    if (isLinux()) {
        return;
    }
    const types = collection === "standard" ? ["Move", "Capture"] : ["Move", "Capture", "Check"];
    for (const type of types) {
        loadSound(collection, type).catch(() => {
            // fails if Tauri APIs are unavailable (e.g., in tests)
        });
    }
}

export function playSound(capture: boolean, check: boolean) {
    // only play at most 1 sound every 75ms
    const now = Date.now();
    if (now - lastTime < 75) {
        return;
    }
    lastTime = now;

    const store = getDefaultStore();
    const collection = store.get(soundCollectionAtom);
    const volume = store.get(soundVolumeAtom);

    let type = "Move";
    if (capture) {
        type = "Capture";
    }
    if (collection !== "standard" && check) {
        type = "Check";
    }

    const playWithUrl = (url: string) => {
        const player = audioPool[poolIndex];
        poolIndex = (poolIndex + 1) % POOL_SIZE;

        player.src = url;
        player.volume = volume;
        player.play().catch((e) => console.error("Audio playback error:", e));
    };

    if (isLinux()) {
        getSoundServerPort()
            .then((port) => {
                const url = `http://127.0.0.1:${port}/${collection}/${type}.mp3`;
                playWithUrl(url);
            })
            .catch(() => {
                // fails if Tauri APIs are unavailable (e.g., in tests)
            });
    } else {
        loadSound(collection, type)
            .then(
                (buffer) => playBuffer(buffer, volume),
                () => {
                    // fails if Tauri APIs are unavailable (e.g., in tests)
                },
            )
            .catch((e) => console.error("Audio playback error:", e));
    }
}
