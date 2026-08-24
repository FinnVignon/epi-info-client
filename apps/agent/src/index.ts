import { readConfig } from "./config.js";
import { createClientConnection } from "./connection/clientConnection.js";
import { createClientHeartbeatConnection } from "./connection/clientHeartbeat.js";
import { createClientPairingController } from "./connection/clientPairing.js";
import { createClientPairingApi } from "./connection/clientPairingApi.js";
import { createClientPairingStatus } from "./connection/clientPairingStatus.js";
import { createClientLiveUpdateConnection } from "./connection/clientLiveUpdates.js";
import { createClientConnectionStatus } from "./connection/connectionStatus.js";
import { createManifestSynchronizer } from "./connection/manifestSync.js";
import { createClientServerApi } from "./connection/serverApi.js";
import { createSyncNotificationManager } from "./connection/syncNotifications.js";
import { startLocalDisplayServer } from "./http/localDisplayServer.js";
import { createAssetCache } from "./storage/assetCache.js";
import { createClientIdentityStore } from "./storage/clientIdentityStore.js";
import { createClientPairingStore } from "./storage/clientPairingStore.js";
import { createClientPaths } from "./storage/clientPaths.js";
import { createManifestStore } from "./storage/manifestStore.js";

async function startAgent(): Promise<void> {
  const config = readConfig();
  const paths = createClientPaths(config.dataPath);
  const manifestStore = createManifestStore(paths);
  const connectionStatus = createClientConnectionStatus();
  const syncNotifications = createSyncNotificationManager();
  const liveUpdates = createClientLiveUpdateConnection({
    config,
    notifications: syncNotifications,
  });
  const identityStore = createClientIdentityStore(paths.identityPath);
  const pairingStore = createClientPairingStore(paths.pairingPath);
  const pairingStatus = createClientPairingStatus();
  const serverApi = createClientServerApi(
    config.serverBaseUrl,
    config.requestTimeoutMs,
    config.assetDownloadTimeoutMs,
  );
  const pairingApi = createClientPairingApi(config.serverBaseUrl, config.requestTimeoutMs);
  const assetCache = createAssetCache({
    api: serverApi,
    paths,
  });
  const manifestSynchronizer = createManifestSynchronizer({
    api: serverApi,
    assetCache,
    manifestStore,
    notifications: syncNotifications,
  });
  const connection = createClientConnection({
    heartbeat: createClientHeartbeatConnection({
      api: serverApi,
      config,
      liveUpdates,
      manifestStore,
      manifestSynchronizer,
      status: connectionStatus,
    }),
    identityStore,
    pairing: createClientPairingController({
      api: pairingApi,
      config,
      identityStore,
      pairingStore,
      status: pairingStatus,
    }),
    status: connectionStatus,
  });
  const localServer = await startLocalDisplayServer({
    assetCache,
    config,
    connectionStatus,
    manifestStore,
    pairingStatus,
    paths,
    syncNotifications,
  });

  connection.start();

  const shutdown = (): void => {
    connection.stop();
    localServer.close(() => process.exit(0));
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startAgent().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
