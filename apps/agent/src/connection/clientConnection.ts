import type { ClientConfig } from "../config.js";
import type { ClientIdentity, ClientIdentityStore } from "../storage/clientIdentityStore.js";
import type { ManifestStore } from "../storage/manifestStore.js";
import type { ClientConnectionStatus } from "./connectionStatus.js";
import { ServerApiError, type ClientServerApi } from "./serverApi.js";

export interface ClientConnection {
  start(): void;
  stop(): void;
}

interface ClientConnectionDependencies {
  api: ClientServerApi;
  config: ClientConfig;
  identityStore: ClientIdentityStore;
  manifestStore: ManifestStore;
  status: ClientConnectionStatus;
}

export function createClientConnection({
  api,
  config,
  identityStore,
  manifestStore,
  status,
}: ClientConnectionDependencies): ClientConnection {
  let retrySeconds = config.retryMinSeconds;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  return {
    start(): void {
      void initialize();
    },
    stop(): void {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };

  async function initialize(): Promise<void> {
    try {
      const identity = await identityStore.load();

      if (identity) {
        status.update({
          clientId: identity.clientId,
          state: "connecting",
        });
        scheduleHeartbeat(identity, 0);
        return;
      }

      if (!config.enrollmentToken) {
        status.update({
          lastError: "CLIENT_ENROLLMENT_TOKEN is required for first enrollment",
          state: "awaiting_enrollment",
        });
        console.warn("Client is not enrolled. Set CLIENT_ENROLLMENT_TOKEN and restart the agent.");
        return;
      }

      scheduleEnrollment(0);
    } catch (error) {
      const message = readErrorMessage(error);

      status.update({
        lastError: message,
        state: "identity_error",
      });
      console.error(`Unable to read client identity: ${message}`);
    }
  }

  function scheduleEnrollment(delaySeconds: number): void {
    schedule(async () => {
      status.update({
        lastError: null,
        state: "connecting",
      });

      try {
        const response = await api.register({
          enrollmentToken: config.enrollmentToken ?? "",
          name: config.clientName,
          softwareVersion: config.softwareVersion,
        });
        const identity: ClientIdentity = {
          clientId: response.clientId,
          clientSecret: response.clientSecret,
          enrolledAt: new Date().toISOString(),
        };

        status.update({
          clientId: identity.clientId,
          state: "persisting_identity",
        });
        await persistNewIdentity(identity);
      } catch (error) {
        handleEnrollmentFailure(error);
      }
    }, delaySeconds);
  }

  async function persistNewIdentity(identity: ClientIdentity): Promise<void> {
    try {
      await identityStore.save(identity);
      retrySeconds = config.retryMinSeconds;
      console.info(`Client enrollment completed for ${identity.clientId}`);
      scheduleHeartbeat(identity, 0);
    } catch (error) {
      const message = readErrorMessage(error);

      status.update({
        lastError: message,
        state: "persisting_identity",
      });
      console.error(`Unable to persist client identity; retrying: ${message}`);
      schedule(() => persistNewIdentity(identity), nextRetryDelay());
    }
  }

  function handleEnrollmentFailure(error: unknown): void {
    const message = readErrorMessage(error);

    if (error instanceof ServerApiError && (error.status === 400 || error.status === 401)) {
      status.update({
        lastError: message,
        nextAttemptAt: null,
        state: "enrollment_rejected",
      });
      console.error(`Client enrollment was rejected: ${message}`);
      return;
    }

    const delaySeconds =
      error instanceof ServerApiError && error.retryAfterSeconds
        ? error.retryAfterSeconds
        : nextRetryDelay();

    status.update({
      lastError: message,
      state: "disconnected",
    });
    console.warn(`Client enrollment failed; retrying in ${delaySeconds}s: ${message}`);
    scheduleEnrollment(delaySeconds);
  }

  function scheduleHeartbeat(identity: ClientIdentity, delaySeconds: number): void {
    schedule(async () => {
      status.update({
        clientId: identity.clientId,
        state: "connecting",
      });

      try {
        const manifest = manifestStore.getActiveManifest();
        const response = await api.sendHeartbeat(identity, {
          currentManifestId: manifest.id,
          currentManifestVersion: manifest.version,
          lastError: null,
          lastSyncResult: "not_started",
          softwareVersion: config.softwareVersion,
        });

        retrySeconds = config.retryMinSeconds;
        status.update({
          lastError: null,
          lastSuccessfulHeartbeatAt: new Date().toISOString(),
          state: "connected",
        });
        scheduleHeartbeat(
          identity,
          positiveSeconds(response.heartbeatIntervalSeconds, config.heartbeatIntervalSeconds),
        );
      } catch (error) {
        const message = readErrorMessage(error);
        const authenticationRejected = error instanceof ServerApiError && error.status === 401;
        const delaySeconds = authenticationRejected
          ? config.retryMaxSeconds
          : error instanceof ServerApiError && error.retryAfterSeconds
            ? error.retryAfterSeconds
            : nextRetryDelay();

        status.update({
          lastError: message,
          state: "disconnected",
        });
        console.warn(`Client heartbeat failed; retrying in ${delaySeconds}s: ${message}`);
        scheduleHeartbeat(identity, delaySeconds);
      }
    }, delaySeconds);
  }

  function schedule(task: () => void | Promise<void>, delaySeconds: number): void {
    if (stopped) {
      return;
    }

    const normalizedDelaySeconds = Math.max(0, delaySeconds);

    status.update({
      nextAttemptAt: new Date(Date.now() + normalizedDelaySeconds * 1000).toISOString(),
    });
    timer = setTimeout(() => {
      timer = null;
      status.update({ nextAttemptAt: null });

      if (!stopped) {
        void task();
      }
    }, normalizedDelaySeconds * 1000);
  }

  function nextRetryDelay(): number {
    const currentDelay = retrySeconds;

    retrySeconds = Math.min(config.retryMaxSeconds, retrySeconds * 2);

    return currentDelay;
  }
}

function positiveSeconds(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client connection error";
}
