import type { ClientConfig } from "../config.js";
import type { ClientIdentity } from "../storage/clientIdentityStore.js";
import type { ManifestStore } from "../storage/manifestStore.js";
import type { ClientConnectionStatus } from "./connectionStatus.js";
import type { ClientLiveUpdateConnection } from "./clientLiveUpdates.js";
import type { ManifestSynchronizer } from "./manifestSync.js";
import { createRetryScheduler } from "./retryScheduler.js";
import type { ClientServerApi } from "./serverApi.js";
import { ServerApiError } from "./serverApiError.js";

export interface ClientHeartbeatConnection {
  start(identity: ClientIdentity): void;
  stop(): void;
}

interface ClientHeartbeatDependencies {
  api: ClientServerApi;
  config: ClientConfig;
  liveUpdates: ClientLiveUpdateConnection;
  manifestStore: ManifestStore;
  manifestSynchronizer: ManifestSynchronizer;
  status: ClientConnectionStatus;
}

export function createClientHeartbeatConnection({
  api,
  config,
  liveUpdates,
  manifestStore,
  manifestSynchronizer,
  status,
}: ClientHeartbeatDependencies): ClientHeartbeatConnection {
  let shouldNotifyNextSyncFailure = false;
  const scheduler = createRetryScheduler({
    maxRetrySeconds: config.retryMaxSeconds,
    minRetrySeconds: config.retryMinSeconds,
    onNextAttemptChange: (nextAttemptAt) => status.update({ nextAttemptAt }),
  });

  return {
    start(identity): void {
      scheduler.start();
      status.update({ clientId: identity.clientId, lastError: null, state: "connecting" });
      liveUpdates.start(identity, {
        onAssignmentChanged: () => {
          shouldNotifyNextSyncFailure = true;
          scheduleHeartbeat(identity, 0);
        },
      });
      scheduleHeartbeat(identity, 0);
    },
    stop(): void {
      scheduler.stop();
      liveUpdates.stop();
    },
  };

  function scheduleHeartbeat(identity: ClientIdentity, delaySeconds: number): void {
    scheduler.schedule(async () => {
      status.update({ clientId: identity.clientId, state: "connecting" });

      try {
        const syncResult = await syncManifest(identity);
        const manifest = manifestStore.getActiveManifest();
        const response = await api.sendHeartbeat(identity, {
          currentManifestId: manifest.id,
          currentManifestVersion: manifest.version,
          lastError: syncResult.lastError,
          lastSyncResult: syncResult.lastSyncResult,
          softwareVersion: config.softwareVersion,
        });

        scheduler.resetBackoff();
        status.update({
          lastError: syncResult.lastError,
          lastSuccessfulHeartbeatAt: new Date().toISOString(),
          state: "connected",
        });
        scheduleHeartbeat(
          identity,
          positiveSeconds(response.heartbeatIntervalSeconds, config.heartbeatIntervalSeconds),
        );
      } catch (error) {
        handleHeartbeatFailure(identity, error);
      }
    }, delaySeconds);
  }

  function handleHeartbeatFailure(identity: ClientIdentity, error: unknown): void {
    const message = readErrorMessage(error);
    const authenticationRejected = error instanceof ServerApiError && error.status === 401;
    const serverDelay = error instanceof ServerApiError ? error.retryAfterSeconds : null;
    const delaySeconds = authenticationRejected
      ? config.retryMaxSeconds
      : scheduler.nextRetryDelay(serverDelay);

    status.update({ lastError: message, state: "disconnected" });
    console.warn(`Client heartbeat failed; retrying in ${delaySeconds}s: ${message}`);
    scheduleHeartbeat(identity, delaySeconds);
  }

  async function syncManifest(identity: ClientIdentity): Promise<{
    lastError: string | null;
    lastSyncResult: string;
  }> {
    try {
      const result = await manifestSynchronizer.sync(identity, {
        notifyFailureWithoutManifest: shouldNotifyNextSyncFailure,
      });

      shouldNotifyNextSyncFailure = false;
      return result;
    } catch (error) {
      const message = readErrorMessage(error);

      console.warn(`Client manifest sync failed: ${message}`);
      shouldNotifyNextSyncFailure = false;
      return { lastError: message, lastSyncResult: "sync_failed" };
    }
  }
}

function positiveSeconds(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client connection error";
}
