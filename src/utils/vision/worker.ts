import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { placementFromScores, RESOLUTION } from "./model";

// Reads positions off pictures of boards in the background, so the app doesn't freeze for the
// few seconds a reading takes

export type VisionRequest =
    | { type: "load"; model: Uint8Array }
    | { type: "read"; image: ImageBitmap };

export type VisionResponse =
    | { type: "ready" }
    | { type: "placement"; placement: string }
    | { type: "error"; message: string };

// The pixel normalization the model was trained with (ImageNet's mean and standard deviation)
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const worker = self as unknown as {
    onmessage: ((event: MessageEvent<VisionRequest>) => void) | null;
    postMessage(message: VisionResponse): void;
};

let session: ort.InferenceSession | undefined;

worker.onmessage = (event) => {
    handle(event.data).catch((error) =>
        worker.postMessage({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
        }),
    );
};

async function handle(request: VisionRequest) {
    if (request.type === "load") {
        // The app isn't cross-origin isolated, so the runtime can only use one thread
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.wasmPaths = { wasm: wasmUrl };
        session = await ort.InferenceSession.create(request.model, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
        });
        worker.postMessage({ type: "ready" });
        return;
    }

    if (!session) throw new Error("The model isn't loaded");
    let input: ort.Tensor;
    try {
        input = imageTensor(request.image);
    } finally {
        request.image.close();
    }
    const { logits } = await session.run({ image: input });
    // One image, 64 squares, 13 classes
    if (!logits || logits.dims.join(",") !== "1,64,13") {
        throw new Error("The model gave an unexpected answer");
    }
    worker.postMessage({
        type: "placement",
        placement: placementFromScores(logits.data as Float32Array),
    });
}

function imageTensor(image: ImageBitmap): ort.Tensor {
    const canvas = new OffscreenCanvas(RESOLUTION, RESOLUTION);
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("No canvas to read the image");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, RESOLUTION, RESOLUTION);

    const pixels = context.getImageData(0, 0, RESOLUTION, RESOLUTION).data;
    const size = RESOLUTION * RESOLUTION;
    const data = new Float32Array(3 * size);
    for (let pixel = 0; pixel < size; pixel++) {
        for (let channel = 0; channel < 3; channel++) {
            data[channel * size + pixel] =
                (pixels[pixel * 4 + channel] / 255 - MEAN[channel]) / STD[channel];
        }
    }
    return new ort.Tensor("float32", data, [1, 3, RESOLUTION, RESOLUTION]);
}
