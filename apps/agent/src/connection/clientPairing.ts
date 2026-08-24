import type { ClientConfig } from "../config.js";
import type { ClientIdentity, ClientIdentityStore } from "../storage/clientIdentityStore.js";
import type { ClientPairingStore, StoredClientPairing } from "../storage/clientPairingStore.js";
import type { ClientPairingApi } from "./clientPairingApi.js";
import type { ClientPairingStatus } from "./clientPairingStatus.js";
import { createRetryScheduler } from "./retryScheduler.js";
import { ServerApiError } from "./serverApiError.js";

export interface ClientPairingController {
  start(onPaired: (identity: ClientIdentity) => void): void;
  stop(): void;
}

interface ClientPairingDependencies {
  api: ClientPairingApi;
  config: ClientConfig;
  identityStore: ClientIdentityStore;
  pairingStore: ClientPairingStore;
  status: ClientPairingStatus;
}

export function createClientPairingController({
  api,
  config,
  identityStore,
  pairingStore,
  status,
}: ClientPairingDependencies): ClientPairingController {
  let onPaired: ((identity: ClientIdentity) => void) | null = null;
  const scheduler = createRetryScheduler({
    maxRetrySeconds: config.retryMaxSeconds,
    minRetrySeconds: config.retryMinSeconds,
    onNextAttemptChange: (nextAttemptAt) => {
      status.update(status.getSnapshot().state, { nextAttemptAt });
    },
  });

  return {
    start(handler): void {
      onPaired = handler;
      scheduler.start();
      void initialize();
    },
    stop(): void {
      scheduler.stop();
    },
  };

  async function initialize(): Promise<void> {
    try {
      const storedPairing = await pairingStore.load();

      if (!storedPairing || hasExpired(storedPairing)) {
        if (storedPairing) {
          await pairingStore.clear();
        }

        await requestPairing();
        return;
      }

      showPending(storedPairing);
      schedule(() => pollPairing(storedPairing), storedPairing.pollIntervalSeconds);
    } catch (error) {
      showPermanentError("Unable to read saved pairing", error);
    }
  }

  async function requestPairing(): Promise<void> {
    status.update("requesting", {
      expiresAt: null,
      lastError: null,
      userCode: null,
    });

    try {
      const response = await api.create({
        name: config.clientName,
        softwareVersion: config.softwareVersion,
      });
      const pairing: StoredClientPairing = response;

      await persistNewPairing(pairing);
    } catch (error) {
      const delaySeconds = retryDelayFor(error);

      status.update("error", {
        lastError: readErrorMessage(error),
        userCode: null,
      });
      console.warn(`Client pairing request failed; retrying in ${delaySeconds}s`);
      schedule(requestPairing, delaySeconds);
    }
  }

  async function persistNewPairing(pairing: StoredClientPairing): Promise<void> {
    try {
      if (hasExpired(pairing)) {
        await requestPairing();
        return;
      }

      await pairingStore.save(pairing);
      scheduler.resetBackoff();
      showPending(pairing);
      schedule(() => pollPairing(pairing), pairing.pollIntervalSeconds);
    } catch (error) {
      const delaySeconds = retryDelayFor(error);

      status.update("error", {
        lastError: `Unable to save pairing: ${readErrorMessage(error)}`,
        userCode: pairing.userCode,
      });
      console.error(`Unable to persist client pairing; retrying in ${delaySeconds}s`);
      schedule(() => persistNewPairing(pairing), delaySeconds);
    }
  }

  async function pollPairing(pairing: StoredClientPairing): Promise<void> {
    if (hasExpired(pairing)) {
      await renewPairing();
      return;
    }

    try {
      const response = await api.poll(pairing.deviceCode);

      if (response.status === "approved") {
        await persistApprovedIdentity({
          clientId: response.clientId,
          clientSecret: response.clientSecret,
          enrolledAt: new Date().toISOString(),
        });
        return;
      }

      if (response.status === "pending") {
        const updatedPairing = {
          ...pairing,
          expiresAt: response.expiresAt,
          pollIntervalSeconds: response.pollIntervalSeconds,
        };

        await pairingStore.save(updatedPairing);
        scheduler.resetBackoff();
        showPending(updatedPairing);
        schedule(() => pollPairing(updatedPairing), updatedPairing.pollIntervalSeconds);
        return;
      }

      if (response.status === "rejected") {
        showRejected(pairing);
        return;
      }

      await renewPairing();
    } catch (error) {
      if (error instanceof ServerApiError && error.status === 404) {
        await renewPairing();
        return;
      }

      const delaySeconds = retryDelayFor(error);

      status.update("pending", {
        lastError: readErrorMessage(error),
        userCode: pairing.userCode,
      });
      console.warn(`Client pairing poll failed; retrying in ${delaySeconds}s`);
      schedule(() => pollPairing(pairing), delaySeconds);
    }
  }

  async function persistApprovedIdentity(identity: ClientIdentity): Promise<void> {
    try {
      await identityStore.save(identity);
      await pairingStore.clear().catch((error) => {
        console.warn(`Unable to remove completed pairing file: ${readErrorMessage(error)}`);
      });
      status.reset();
      scheduler.resetBackoff();
      onPaired?.(identity);
    } catch (error) {
      const delaySeconds = retryDelayFor(error);

      status.update("error", {
        lastError: readErrorMessage(error),
        userCode: null,
      });
      console.error(`Unable to persist paired identity; retrying in ${delaySeconds}s`);
      schedule(() => persistApprovedIdentity(identity), delaySeconds);
    }
  }

  async function renewPairing(): Promise<void> {
    try {
      await pairingStore.clear();
      await requestPairing();
    } catch (error) {
      showPermanentError("Unable to replace saved pairing", error);
    }
  }

  function showPending(pairing: StoredClientPairing): void {
    status.update("pending", {
      expiresAt: pairing.expiresAt,
      lastError: null,
      userCode: pairing.userCode,
    });
  }

  function showRejected(pairing: StoredClientPairing): void {
    status.update("rejected", {
      expiresAt: pairing.expiresAt,
      lastError: null,
      userCode: pairing.userCode,
    });
    schedule(renewPairing, secondsUntilExpiration(pairing));
  }

  function showPermanentError(context: string, error: unknown): void {
    const message = `${context}: ${readErrorMessage(error)}`;

    status.update("error", { lastError: message, nextAttemptAt: null });
    console.error(message);
  }

  function schedule(task: () => void | Promise<void>, delaySeconds: number): void {
    scheduler.schedule(task, delaySeconds, 1);
  }

  function retryDelayFor(error: unknown): number {
    return scheduler.nextRetryDelay(
      error instanceof ServerApiError ? error.retryAfterSeconds : null,
    );
  }
}

function hasExpired(pairing: StoredClientPairing): boolean {
  return Date.parse(pairing.expiresAt) <= Date.now();
}

function secondsUntilExpiration(pairing: StoredClientPairing): number {
  return Math.max(1, Math.ceil((Date.parse(pairing.expiresAt) - Date.now()) / 1000));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client pairing error";
}
