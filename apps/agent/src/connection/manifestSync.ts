import type { AssetCache } from "../storage/assetCache.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import type { ManifestStore } from "../storage/manifestStore.js";
import type { ClientServerApi } from "./serverApi.js";

export interface ManifestSyncResult {
  lastError: string | null;
  lastSyncResult: "activated" | "no_assignment" | "up_to_date";
}

export interface ManifestSynchronizer {
  sync(identity: ClientIdentity): Promise<ManifestSyncResult>;
}

interface ManifestSynchronizerDependencies {
  api: ClientServerApi;
  assetCache: AssetCache;
  manifestStore: ManifestStore;
}

export function createManifestSynchronizer({
  api,
  assetCache,
  manifestStore,
}: ManifestSynchronizerDependencies): ManifestSynchronizer {
  let verifiedManifestKey: string | null = null;

  return {
    async sync(identity: ClientIdentity): Promise<ManifestSyncResult> {
      const response = await api.getEffectiveManifest(identity);

      if (!response.manifest) {
        return {
          lastError: null,
          lastSyncResult: "no_assignment",
        };
      }

      const currentManifest = manifestStore.getActiveManifest();
      const assignedManifestKey = createManifestKey(response.manifest);
      const isCurrentManifest =
        currentManifest.id === response.manifest.id &&
        currentManifest.version === response.manifest.version;

      if (isCurrentManifest && verifiedManifestKey === assignedManifestKey) {
        return {
          lastError: null,
          lastSyncResult: "up_to_date",
        };
      }

      await assetCache.ensureManifestAssets(identity, response.manifest);

      if (!isCurrentManifest) {
        await manifestStore.activateManifest(response.manifest);
      }

      verifiedManifestKey = assignedManifestKey;

      return {
        lastError: null,
        lastSyncResult: isCurrentManifest ? "up_to_date" : "activated",
      };
    },
  };
}

function createManifestKey(manifest: { id: string; version: number }): string {
  return `${manifest.id}:${manifest.version}`;
}
