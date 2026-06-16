import type { Manifest } from "../../../shared/contracts.js";
import type { AssetCache } from "../storage/assetCache.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import type { ManifestStore } from "../storage/manifestStore.js";
import type { ClientServerApi } from "./serverApi.js";
import type { SyncNotificationManager } from "./syncNotifications.js";

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
  notifications: SyncNotificationManager;
}

export function createManifestSynchronizer({
  api,
  assetCache,
  manifestStore,
  notifications,
}: ManifestSynchronizerDependencies): ManifestSynchronizer {
  let verifiedManifestKey: string | null = null;

  return {
    async sync(identity: ClientIdentity): Promise<ManifestSyncResult> {
      let syncingManifest: Manifest | null = null;

      try {
        const response = await api.getEffectiveManifest(identity);

        if (!response.manifest) {
          notifications.clear();

          return {
            lastError: null,
            lastSyncResult: "no_assignment",
          };
        }

        const assignedManifest = response.manifest;
        syncingManifest = assignedManifest;
        const currentManifest = manifestStore.getActiveManifest();
        const assignedManifestKey = createManifestKey(assignedManifest);
        const isCurrentManifest =
          currentManifest.id === assignedManifest.id &&
          currentManifest.version === assignedManifest.version;

        if (isCurrentManifest && verifiedManifestKey === assignedManifestKey) {
          notifications.clear();

          return {
            lastError: null,
            lastSyncResult: "up_to_date",
          };
        }

        notifications.showAssignmentReceived({ manifest: assignedManifest });
        await assetCache.ensureManifestAssets(identity, assignedManifest, (progress) => {
          const notificationProgress = {
            completedItems: progress.completedAssets,
            totalItems: progress.totalAssets,
          };

          if (progress.phase === "downloading") {
            notifications.showDownload({
              detail: `Asset ${progress.currentAssetId}`,
              manifest: assignedManifest,
              progress: notificationProgress,
            });
            return;
          }

          if (progress.phase === "verifying") {
            notifications.showVerifying({
              detail: `Asset ${progress.currentAssetId}`,
              manifest: assignedManifest,
              progress: notificationProgress,
            });
            return;
          }

          notifications.showChecking({
            detail: `Asset ${progress.currentAssetId}`,
            manifest: assignedManifest,
            progress: notificationProgress,
          });
        });

        if (!isCurrentManifest) {
          notifications.showActivating({ manifest: assignedManifest });
          await manifestStore.activateManifest(assignedManifest);
          notifications.showWaitingForDisplay({
            manifest: assignedManifest,
            progress: { completedItems: 1, totalItems: 1 },
          });
        } else {
          notifications.clear();
        }

        verifiedManifestKey = assignedManifestKey;

        return {
          lastError: null,
          lastSyncResult: isCurrentManifest ? "up_to_date" : "activated",
        };
      } catch (error) {
        if (syncingManifest) {
          notifications.showFailure({
            error: readErrorMessage(error),
            manifest: syncingManifest,
          });
        }

        throw error;
      }
    },
  };
}

function createManifestKey(manifest: { id: string; version: number }): string {
  return `${manifest.id}:${manifest.version}`;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to synchronize display content";
}
