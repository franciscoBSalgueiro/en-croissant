// ChessQueries Lite v4 by Joël Seytre (https://huggingface.co/joelseytre/chessq-lite), the model
// Lichess uses to read the position from a picture of a board, in the 8-bit ONNX form Lichess
// serves. Its weights are licensed PolyForm Noncommercial 1.0.0, so the app doesn't ship them:
// they're downloaded on first use from where Lichess's own apps get them, and a file is only ever
// used if it is exactly this one.
export const MODEL = {
    url: "https://lichess1.org/assets/lifat/vision/chessq-lite-v4-int8.onnx",
    fileName: "chessq-lite-v4-int8.onnx",
    size: 41370398,
    sha256: "89d75e343c5d98f235855a67588efb469a4e7cff1e003ee6b6ee0de67732ae1f",
};

export async function isExpectedModel(
    bytes: Uint8Array<ArrayBuffer>,
    expected: { size: number; sha256: string } = MODEL,
): Promise<boolean> {
    if (bytes.byteLength !== expected.size) return false;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return hex === expected.sha256;
}

// The model reads a square image of this size
export const RESOLUTION = 644;

// For each of the 64 squares, from a8 to h1 rank by rank, the model scores these 13 classes:
// empty, then the pieces
const CLASSES = ".PNBRQKpnbrqk";

export function placementFromScores(scores: ArrayLike<number>): string {
    const ranks: string[] = [];
    for (let rank = 0; rank < 8; rank++) {
        let row = "";
        let empty = 0;
        for (let file = 0; file < 8; file++) {
            const offset = (rank * 8 + file) * CLASSES.length;
            let best = 0;
            for (let piece = 1; piece < CLASSES.length; piece++) {
                if (scores[offset + piece] > scores[offset + best]) best = piece;
            }
            if (best === 0) {
                empty++;
            } else {
                if (empty) row += empty;
                empty = 0;
                row += CLASSES[best];
            }
        }
        ranks.push(row + (empty || ""));
    }
    return ranks.join("/");
}
