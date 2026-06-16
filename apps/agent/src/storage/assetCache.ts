import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import type { Manifest, MediaManifestItem } from "../../../shared/contracts.js";
import type { ClientServerApi } from "../connection/serverApi.js";
import type { ClientIdentity } from "./clientIdentityStore.js";
import type { ClientPaths } from "./clientPaths.js";

export type AssetCacheProgressPhase = "checking" | "downloading" | "verifying";

export interface AssetCacheProgress {
  completedAssets: number;
  currentAssetId: string;
  phase: AssetCacheProgressPhase;
  totalAssets: number;
}

export type AssetCacheProgressHandler = (progress: AssetCacheProgress) => void;

export interface AssetCache {
  deleteAssetsNotInManifest(manifest: Manifest): Promise<void>;
  ensureManifestAssets(
    identity: ClientIdentity,
    manifest: Manifest,
    onProgress?: AssetCacheProgressHandler,
  ): Promise<void>;
}

interface AssetCacheDependencies {
  api: ClientServerApi;
  paths: ClientPaths;
}

export function createAssetCache({ api, paths }: AssetCacheDependencies): AssetCache {
  return {
    async deleteAssetsNotInManifest(manifest: Manifest): Promise<void> {
      const retainedAssetPaths = new Set(
        manifest.items
          .filter(isMediaItem)
          .map((item) => resolveLocalAssetPath(paths.assetsPath, item.localPath)),
      );

      await removeUnusedFiles(paths.assetsPath, retainedAssetPaths);
    },

    async ensureManifestAssets(
      identity: ClientIdentity,
      manifest: Manifest,
      onProgress?: AssetCacheProgressHandler,
    ): Promise<void> {
      const mediaItems = collectUniqueMediaItems(manifest);
      let completedAssets = 0;

      for (const item of mediaItems) {
        await ensureAsset(identity, item, (phase) => {
          onProgress?.({
            completedAssets,
            currentAssetId: item.assetId,
            phase,
            totalAssets: mediaItems.length,
          });
        });
        completedAssets += 1;
      }
    },
  };

  async function ensureAsset(
    identity: ClientIdentity,
    item: MediaManifestItem,
    onPhaseChange: (phase: AssetCacheProgressPhase) => void,
  ): Promise<void> {
    const assetPath = resolveLocalAssetPath(paths.assetsPath, item.localPath);

    await mkdir(path.dirname(assetPath), { recursive: true });
    onPhaseChange("checking");

    if (await doesFileMatchHash(assetPath, item.sha256)) {
      return;
    }

    const temporaryPath = `${assetPath}.${randomUUID()}.download`;

    try {
      onPhaseChange("downloading");
      await api.downloadAsset(identity, item.remoteUrl, temporaryPath);

      onPhaseChange("verifying");
      if (!(await doesFileMatchHash(temporaryPath, item.sha256))) {
        throw new Error(`Downloaded asset ${item.assetId} failed SHA-256 verification`);
      }

      await rename(temporaryPath, assetPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
}

function collectUniqueMediaItems(manifest: Manifest): MediaManifestItem[] {
  const uniqueItems = new Map<string, MediaManifestItem>();

  for (const item of manifest.items) {
    if (isMediaItem(item)) {
      uniqueItems.set(`${item.assetId}:${item.localPath}:${item.sha256}`, item);
    }
  }

  return [...uniqueItems.values()];
}

async function removeUnusedFiles(directoryPath: string, retainedPaths: Set<string>): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await removeUnusedFiles(entryPath, retainedPaths);

      if ((await readdir(entryPath)).length === 0) {
        await rm(entryPath, { recursive: true });
      }

      continue;
    }

    if (!retainedPaths.has(entryPath)) {
      await rm(entryPath, { force: true });
    }
  }
}

function isMediaItem(item: Manifest["items"][number]): item is MediaManifestItem {
  return item.type === "image" || item.type === "video";
}

async function doesFileMatchHash(filePath: string, expectedSha256: string): Promise<boolean> {
  try {
    return (await calculateSha256(filePath)) === expectedSha256.toLowerCase();
  } catch {
    return false;
  }
}

function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function resolveLocalAssetPath(assetsPath: string, localPath: string): string {
  const pathname = new URL(localPath, "http://local-display").pathname;

  if (!pathname.startsWith("/assets/")) {
    throw new Error(`Manifest asset path is outside the local asset directory: ${localPath}`);
  }

  const decodedPath = decodeURIComponent(pathname.slice("/assets/".length));
  const resolvedAssetsPath = path.resolve(assetsPath);
  const resolvedAssetPath = path.resolve(resolvedAssetsPath, decodedPath);

  if (!resolvedAssetPath.startsWith(`${resolvedAssetsPath}${path.sep}`)) {
    throw new Error(`Manifest asset path is unsafe: ${localPath}`);
  }

  return resolvedAssetPath;
}
