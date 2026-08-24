import type { ClientIdentity, ClientIdentityStore } from "../storage/clientIdentityStore.js";
import type { ClientConnectionStatus } from "./connectionStatus.js";
import type { ClientHeartbeatConnection } from "./clientHeartbeat.js";
import type { ClientPairingController } from "./clientPairing.js";

export interface ClientConnection {
  start(): void;
  stop(): void;
}

interface ClientConnectionDependencies {
  heartbeat: ClientHeartbeatConnection;
  identityStore: ClientIdentityStore;
  pairing: ClientPairingController;
  status: ClientConnectionStatus;
}

export function createClientConnection({
  heartbeat,
  identityStore,
  pairing,
  status,
}: ClientConnectionDependencies): ClientConnection {
  return {
    start(): void {
      void initialize();
    },
    stop(): void {
      heartbeat.stop();
      pairing.stop();
    },
  };

  async function initialize(): Promise<void> {
    try {
      const identity = await identityStore.load();

      if (identity) {
        connect(identity);
        return;
      }

      status.update({ state: "awaiting_pairing" });
      pairing.start(connect);
    } catch (error) {
      const message = readErrorMessage(error);

      status.update({ lastError: message, state: "identity_error" });
      console.error(`Unable to read client identity: ${message}`);
    }
  }

  function connect(identity: ClientIdentity): void {
    heartbeat.start(identity);
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client identity error";
}
