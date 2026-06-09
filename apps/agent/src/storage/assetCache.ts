import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import type { Manifest, MediaManifestItem } from "../../../shared/contracts.js";
import type { ClientServerApi } from "../connection/serverApi.js";
import type { ClientIdentity } from "./clientIdentityStore.js";
import type { ClientPaths } from "./clientPaths.js";

export interface AssetCache {
  ensureManifestAssets(identity: ClientIdentity, manifest: Manifest): Promise<void>;
}

interface AssetCacheDependencies {
  api: ClientServerApi;
  paths: ClientPaths;
}

export function createAssetCache({ api, paths }: AssetCacheDependencies): AssetCache {
  return {
    async ensureManifestAssets(identity: ClientIdentity, manifest: Manifest): Promise<void> {
      const mediaItems = manifest.items.filter(isMediaItem);

      for (const item of mediaItems) {
        await ensureAsset(identity, item);
      }
    },
  };

  async function ensureAsset(identity: ClientIdentity, item: MediaManifestItem): Promise<void> {
    const assetPath = resolveLocalAssetPath(paths.assetsPath, item.localPath);

    await mkdir(path.dirname(assetPath), { recursive: true });

    if (await doesFileMatchHash(assetPath, item.sha256)) {
      return;
    }

    const temporaryPath = `${assetPath}.${randomUUID()}.download`;

    try {
      await api.downloadAsset(identity, item.remoteUrl, temporaryPath);

      if (!(await doesFileMatchHash(temporaryPath, item.sha256))) {
        throw new Error(`Downloaded asset ${item.assetId} failed SHA-256 verification`);
      }

      await rename(temporaryPath, assetPath);
    } finally {
      await rm(temporaryPath, { force: true });
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
