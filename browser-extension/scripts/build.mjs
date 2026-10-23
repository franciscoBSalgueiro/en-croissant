import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (manifest.version !== pkg.version) throw new Error("Manifest/package versions must match");
const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });

async function zipEntries(directory, prefix = "") {
  const entries = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory())
      Object.assign(entries, await zipEntries(join(directory, entry.name), `${name}/`));
    else
      entries[name] = [
        new Uint8Array(await readFile(join(directory, entry.name))),
        {
          mtime: new Date("2020-01-01T00:00:00Z"),
        },
      ];
  }
  return entries;
}

for (const browser of ["chrome", "firefox"]) {
  const target = join(dist, browser);
  await mkdir(target, { recursive: true });
  const output = structuredClone(manifest);
  if (browser === "chrome") delete output.browser_specific_settings;
  await writeFile(join(target, "manifest.json"), `${JSON.stringify(output, null, 2)}\n`);
  for (const path of ["src", "icons"])
    await cp(join(root, path), join(target, path), { recursive: true });
  await cp(join(root, "..", "LICENSE"), join(target, "LICENSE"));
  const archive = join(dist, `en-croissant-${browser}-${manifest.version}.zip`);
  await writeFile(archive, zipSync(await zipEntries(target), { level: 9 }));
  console.log(`Built ${archive}`);
}
