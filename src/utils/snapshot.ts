// WebKit (the app's engine on macOS) only starts loading a PNG or JPEG inside an SVG image,
// such as the board's background, the first time the SVG is drawn, so a single draw leaves
// it out. Draw, give it time to load, then draw again.
const REDRAW_DELAY_MS = 200;

export async function svgToPngBlob(
    svgUrl: string,
    width: number,
    height: number,
): Promise<Blob | null> {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();

    // At least twice the board's size, so the snapshot is as sharp as the board on a Retina
    // screen even when it's taken on a 1x screen; denser screens get their full density
    const scale = Math.max(window.devicePixelRatio, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    await new Promise((resolve) => setTimeout(resolve, REDRAW_DELAY_MS));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
