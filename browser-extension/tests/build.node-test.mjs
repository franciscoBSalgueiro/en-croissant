import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const build = () => execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root });

test("browser packages are reproducible, self-contained, and share the same code", async () => {
  const readPackages = () =>
    Promise.all(
      ["chrome", "firefox"].map((browser) =>
        readFile(new URL(`../dist/en-croissant-${browser}-${version}.zip`, import.meta.url)),
      ),
    );
  build();
  const first = await readPackages();
  build();
  const second = await readPackages();
  assert.deepEqual(second, first);
  const [chrome, firefox] = second.map(unzipSync);
  const decode = (value) => new TextDecoder().decode(value);
  for (const files of [chrome, firefox]) {
    const manifest = JSON.parse(decode(files["manifest.json"]));
    for (const path of [
      ...manifest.content_scripts[0].js,
      ...manifest.content_scripts[0].css,
      ...Object.values(manifest.icons),
      "LICENSE",
    ]) {
      assert.ok(files[path]?.length, path);
    }
    assert.equal(Object.keys(files).length, 9);
    assert.equal(manifest.version, version);
  }
  assert.equal(JSON.parse(decode(chrome["manifest.json"])).browser_specific_settings, undefined);
  assert.equal(
    JSON.parse(decode(firefox["manifest.json"])).browser_specific_settings.gecko.id,
    "analyze@encroissant.org",
  );
  for (const path of Object.keys(chrome).filter((path) => path !== "manifest.json")) {
    assert.deepEqual(chrome[path], firefox[path], path);
  }
});
