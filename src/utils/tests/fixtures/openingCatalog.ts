import { parseOpeningCatalog } from "../../openingCatalog";

// Minimal move-tree fixtures, never imported by application code.
export const catalogVolumes = [
    "eco\tname\tpgn\nA00\tAmar Opening\t1. Nh3\nA00\tAmar Opening: Paris Gambit\t1. Nh3 d5 2. g3 e5 3. f4",
    "eco\tname\tpgn\nB00\tTest King Pawn Defense\t1. e4 e6",
    "eco\tname\tpgn\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4\nC50\tItalian Game\t1. e4 e5 2. Bc4 Nc6 3. Nf3\nC50\tItalian Game: Two Knights\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6",
    "eco\tname\tpgn\nD00\tTest Queen Pawn Defense\t1. d4 d5",
    "eco\tname\tpgn\nE00\tTest Indian Defense\t1. d4 Nf6 2. c4 e6",
];
export const testCatalog = parseOpeningCatalog(catalogVolumes);
