#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const RELEASE_OWNER = process.env.AIX_EXTENSION_OWNER || "franciscoBSalgueiro";
const RELEASE_REPO = process.env.AIX_EXTENSION_REPO || "aix";
const RELEASE_TAG = process.env.AIX_EXTENSION_TAG || "latest";
const EXPLICIT_TARGET = process.env.AIX_EXTENSION_TARGET;
const FORCE_DOWNLOAD = process.env.AIX_EXTENSION_FORCE_DOWNLOAD === "1";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const outputPath = join(repoRoot, "aixchess.duckdb_extension");

const HOST_TARGETS = {
  "linux:x64": "linux_amd64",
  "linux:arm64": "linux_arm64",
  "darwin:x64": "osx_amd64",
  "darwin:arm64": "osx_arm64",
  "win32:x64": "windows_amd64",
  "win32:arm64": "windows_arm64",
};

function resolveTarget() {
  if (EXPLICIT_TARGET?.trim()) {
    return EXPLICIT_TARGET.trim();
  }

  const hostKey = `${process.platform}:${process.arch}`;
  const hostTarget = HOST_TARGETS[hostKey];

  if (!hostTarget) {
    throw new Error(
      `Unsupported host platform/arch: ${hostKey}. Set AIX_EXTENSION_TARGET explicitly.`,
    );
  }

  return hostTarget;
}

function releaseUrl() {
  const base = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases`;
  if (RELEASE_TAG === "latest") {
    return `${base}/latest`;
  }
  return `${base}/tags/${encodeURIComponent(RELEASE_TAG)}`;
}

function buildHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "en-croissant-build",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchRelease() {
  const response = await fetch(releaseUrl(), { headers: buildHeaders() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch release metadata (${response.status}): ${body || response.statusText}`,
    );
  }
  return response.json();
}

async function downloadAsset(url, destination) {
  const response = await fetch(url, { headers: buildHeaders() });
  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(
      `Failed to download extension asset (${response.status}): ${body || response.statusText}`,
    );
  }

  const tempPath = `${destination}.tmp`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
  await fs.rename(tempPath, destination);
}

async function main() {
  const target = resolveTarget();

  if (!FORCE_DOWNLOAD) {
    try {
      const stats = await fs.stat(outputPath);
      if (stats.isFile() && stats.size > 0) {
        console.log(
          `Using existing aix extension at ${outputPath}. Set AIX_EXTENSION_FORCE_DOWNLOAD=1 to refresh.`,
        );
        return;
      }
    } catch {
      // File does not exist yet; continue.
    }
  }

  const release = await fetchRelease();
  const suffix = `-extension-${target}.duckdb_extension`;
  const asset = release.assets?.find((item) => item.name?.endsWith(suffix));

  if (!asset?.browser_download_url) {
    const available = (release.assets || []).map((item) => item.name).join(", ");
    throw new Error(
      `Could not find aix extension asset ending with '${suffix}' in release '${release.tag_name}'. Available assets: ${available}`,
    );
  }

  await downloadAsset(asset.browser_download_url, outputPath);
  console.log(`Downloaded ${asset.name} from release ${release.tag_name} to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
