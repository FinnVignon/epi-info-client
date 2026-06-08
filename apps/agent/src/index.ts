import { readConfig } from "./config.js";
import { createClientConnection } from "./connection/clientConnection.js";
import { createClientConnectionStatus } from "./connection/connectionStatus.js";
import { createClientServerApi } from "./connection/serverApi.js";
import { startLocalDisplayServer } from "./http/localDisplayServer.js";
import { createClientIdentityStore } from "./storage/clientIdentityStore.js";
import { createClientPaths } from "./storage/clientPaths.js";
import { createManifestStore } from "./storage/manifestStore.js";

async function startAgent(): Promise<void> {
  const config = readConfig();
  const paths = createClientPaths(config.dataPath);
  const manifestStore = createManifestStore(paths);
  const connectionStatus = createClientConnectionStatus();
  const identityStore = createClientIdentityStore(paths.identityPath);
  const serverApi = createClientServerApi(config.serverBaseUrl, config.requestTimeoutMs);
  const connection = createClientConnection({
    api: serverApi,
    config,
    identityStore,
    manifestStore,
    status: connectionStatus,
  });
  const localServer = await startLocalDisplayServer({
    config,
    connectionStatus,
    manifestStore,
    paths,
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
