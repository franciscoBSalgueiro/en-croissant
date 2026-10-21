import { resolve } from "@tauri-apps/api/path";
import { exists, readFile, remove } from "@tauri-apps/plugin-fs";
import { commands, events } from "@/bindings";
import { getVisionDir } from "@/utils/directories";
import { isExpectedModel, MODEL } from "./model";
import type { VisionRequest, VisionResponse } from "./worker";

// The user chose not to download the model
export class DownloadDeclined extends Error {}

export interface ReadOptions {
    confirmDownload: () => Promise<boolean>;
    onDownloadProgress: (percent: number) => void;
}

// The worker that reads images, started once per run of the app (and again after a failure)
let reader: Promise<Worker> | null = null;

// Reads the piece placement (the first field of a FEN) off a picture of a board
export async function readPlacement(image: Blob, options: ReadOptions): Promise<string> {
    if (!reader) {
        reader = startReader(options);
        reader.catch(() => {
            reader = null;
        });
    }
    const worker = await reader;
    const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    const response = await request(worker, { type: "read", image: bitmap }, [bitmap]);
    if (response.type !== "placement") throw new Error("The model gave an unexpected answer");
    return response.placement;
}

async function startReader(options: ReadOptions): Promise<Worker> {
    const model = await loadModel(options);
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    try {
        await request(worker, { type: "load", model }, []);
    } catch (error) {
        worker.terminate();
        throw error;
    }
    return worker;
}

// Downloads the model if it isn't there yet (only if the user agrees), and only returns it if it
// is exactly the expected file; anything else is deleted
export async function loadModel({
    confirmDownload,
    onDownloadProgress,
}: ReadOptions): Promise<Uint8Array> {
    const path = await resolve(await getVisionDir(), MODEL.fileName);
    if (!(await exists(path))) {
        if (!(await confirmDownload())) throw new DownloadDeclined();
        const id = "vision_model";
        const unlisten = await events.progressEvent.listen(({ payload }) => {
            if (payload.id === id) onDownloadProgress(payload.progress);
        });
        try {
            const result = await commands.downloadFile(id, MODEL.url, path, null, null, MODEL.size);
            if (result.status === "error") throw new Error(result.error);
        } finally {
            unlisten();
        }
    }
    const bytes = await readFile(path);
    if (!(await isExpectedModel(bytes))) {
        await remove(path);
        throw new Error("The downloaded model isn't the expected file, so it was deleted");
    }
    return bytes;
}

function request(
    worker: Worker,
    message: VisionRequest,
    transfer: Transferable[],
): Promise<VisionResponse> {
    return new Promise((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<VisionResponse>) => {
            if (event.data.type === "error") reject(new Error(event.data.message));
            else resolve(event.data);
        };
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(message, transfer);
    });
}
