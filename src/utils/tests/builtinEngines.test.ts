import { describe, expect, it } from "vitest";
import { getBuiltinEngines } from "../builtinEngines";

describe("getBuiltinEngines", () => {
    it("returns the nine Maia networks plus Maia 2 on macOS", () => {
        const engines = getBuiltinEngines("macos");
        expect(engines).toHaveLength(10);
        for (const rating of [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]) {
            const engine = engines.find((e) => e.name === `Maia ${rating}`);
            expect(engine).toBeDefined();
            expect(engine!.elo).toBe(rating);
            expect(engine!.downloadLink).toContain("lc0");
            expect(engine!.extraDownloads).toEqual([
                `https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-${rating}.pb.gz`,
            ]);
            expect(engine!.presetGo).toEqual({ t: "Nodes", c: 1 });
            expect(engine!.presetSettings).toEqual([
                { name: "WeightsFile", value: `{{ENGINES_DIR}}/maia-${rating}.pb.gz` },
            ]);
        }
    });

    it("installs the Maia 2 UCI wrapper scripts on macOS", () => {
        const engine = getBuiltinEngines("macos").find((e) => e.name === "Maia 2");
        expect(engine).toBeDefined();
        expect(engine!.downloadLink).toMatch(/maia2-uci\/maia2$/);
        expect(engine!.extraDownloads).toEqual([
            expect.stringMatching(/maia2-uci\/maia2_uci\.py$/),
        ]);
        expect(engine!.path).toBe("maia2");
        expect(engine!.presetSettings).toEqual([{ name: "MaiaElo", value: "1500" }]);
    });

    it("does not offer Maia 2 on Windows (no launcher there yet)", () => {
        const engines = getBuiltinEngines("windows");
        expect(engines).toHaveLength(9);
        expect(engines.find((e) => e.name === "Maia 2")).toBeUndefined();
    });

    it("uses the universal lc0 binary directly on macOS", () => {
        const engine = getBuiltinEngines("macos")[0];
        expect(engine.downloadDir).toBeUndefined();
        expect(engine.path).toMatch(/^lc0-/);
    });

    it("extracts the Windows lc0 zip into its own subdirectory", () => {
        const engine = getBuiltinEngines("windows")[0];
        expect(engine.downloadDir).toBe("lc0-v0.32.1-windows-cpu-dnnl");
        expect(engine.path).toBe("lc0-v0.32.1-windows-cpu-dnnl/lc0.exe");
    });

    it("returns nothing on Linux (no official lc0 binaries)", () => {
        expect(getBuiltinEngines("linux")).toEqual([]);
    });
});
