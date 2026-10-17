import type { Platform } from "@tauri-apps/plugin-os";
import type { GoMode } from "@/bindings";
import type { LocalEngine } from "./engines";

/**
 * Catalog entry for an engine that can be installed from the "Download" tab.
 *
 * Mirrors the remote catalog shape (a LocalEngine without its `id`, which is
 * only assigned on install) and adds the fields needed to install engines
 * composed of several files, like Maia: an lc0 binary plus a network weights
 * file that must be selected through the `WeightsFile` UCI option.
 */
export type CatalogEngine = Omit<LocalEngine, "id"> & {
    /** Extra files (e.g. network weights) downloaded into the engines directory. */
    extraDownloads?: string[];
    /** Subdirectory of the engines directory where the main archive is extracted. */
    downloadDir?: string;
    /** UCI options applied on install. `{{ENGINES_DIR}}` is replaced with the engines directory. */
    presetSettings?: { name: string; value: string }[];
    /** Default search limit applied on install (Maia networks are meant to run at 1 node). */
    presetGo?: GoMode;
};

const LC0_VERSION = "v0.33.0-rc0";
// Official lc0 release binaries. The macOS build is a universal (x86_64 + arm64)
// single-file executable; the Windows build is a flat zip (lc0.exe at the root,
// with a bundled default network, CPU-only via DNNL).
const LC0_MACOS = {
    downloadLink: `https://github.com/LeelaChessZero/lc0/releases/download/${LC0_VERSION}/lc0-${LC0_VERSION}-macos_13.2.1`,
    path: `lc0-${LC0_VERSION}-macos_13.2.1`,
    downloadDir: undefined,
    size: 5262432,
};
const LC0_WINDOWS = {
    downloadLink: `https://github.com/LeelaChessZero/lc0/releases/download/v0.32.1/lc0-v0.32.1-windows-cpu-dnnl.zip`,
    path: `lc0-v0.32.1-windows-cpu-dnnl/lc0.exe`,
    downloadDir: "lc0-v0.32.1-windows-cpu-dnnl",
    size: 24001097,
};

const MAIA_VERSION = "1.0";
const MAIA_SIZE = 1258199;
/** Human-like networks from https://lczero.org/play/networks/sparring-nets/ */
const MAIA_RATINGS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];

function maiaWeightsUrl(rating: number): string {
    return `https://github.com/CSSLab/maia-chess/releases/download/v${MAIA_VERSION}/maia-${rating}.pb.gz`;
}

/**
 * Engines that ship with the app because they are not available in the remote
 * catalog. Each Maia network is installed as its own engine: lc0 plus the
 * network weights, with `WeightsFile` preset and a default search of 1 node
 * (these networks predict human moves directly, deeper search defeats the point).
 *
 * Maia 2 is a transformer model with no official UCI build, so the app ships
 * its own UCI wrapper (see `maia2-uci/`): a launcher script plus a Python
 * engine built on the official `maia2` package. On first use the launcher
 * creates a Python 3.10-3.12 environment next to itself and downloads the
 * model weights; the static UCI banner it prints meanwhile keeps engine
 * configuration instant.
 */
export function getBuiltinEngines(os: Platform): CatalogEngine[] {
    if (os !== "macos" && os !== "windows") {
        // lc0 does not publish Linux binaries; Linux users can still install
        // Maia manually with a self-built lc0 through the "Local" tab.
        return [];
    }
    const engines: CatalogEngine[] = MAIA_RATINGS.map((rating) => ({
        type: "local" as const,
        name: `Maia ${rating}`,
        version: MAIA_VERSION,
        elo: rating,
        downloadLink: (os === "macos" ? LC0_MACOS : LC0_WINDOWS).downloadLink,
        path: (os === "macos" ? LC0_MACOS : LC0_WINDOWS).path,
        downloadDir: (os === "macos" ? LC0_MACOS : LC0_WINDOWS).downloadDir,
        downloadSize: (os === "macos" ? LC0_MACOS : LC0_WINDOWS).size + MAIA_SIZE,
        extraDownloads: [maiaWeightsUrl(rating)],
        presetSettings: [
            {
                name: "WeightsFile",
                value: `{{ENGINES_DIR}}/maia-${rating}.pb.gz`,
            },
        ],
        presetGo: { t: "Nodes", c: 1 },
    }));
    if (os === "macos") {
        // the UCI wrapper for Maia 2 is two small scripts; Python and the
        // model are pulled in by the launcher on first use
        const base =
            "https://raw.githubusercontent.com/franciscoBSalgueiro/en-croissant/master/maia2-uci";
        engines.push({
            type: "local",
            name: "Maia 2",
            version: "2",
            elo: 1900,
            downloadLink: `${base}/maia2`,
            path: "maia2",
            downloadSize: 20480,
            extraDownloads: [`${base}/maia2_uci.py`],
            presetSettings: [{ name: "MaiaElo", value: "1500" }],
        });
    }
    return engines;
}
