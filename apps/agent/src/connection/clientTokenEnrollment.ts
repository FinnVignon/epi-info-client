import type { ClientConfig } from "../config.js";
import type { ClientIdentity, ClientIdentityStore } from "../storage/clientIdentityStore.js";
import type { ClientConnectionStatus } from "./connectionStatus.js";
import { createRetryScheduler } from "./retryScheduler.js";
import type { ClientServerApi } from "./serverApi.js";
import { ServerApiError } from "./serverApiError.js";

export interface ClientTokenEnrollment {
  start(onEnrolled: (identity: ClientIdentity) => void): void;
  stop(): void;
}

interface ClientTokenEnrollmentDependencies {
  api: ClientServerApi;
  config: ClientConfig;
  identityStore: ClientIdentityStore;
  status: ClientConnectionStatus;
}

export function createClientTokenEnrollment({
  api,
  config,
  identityStore,
  status,
}: ClientTokenEnrollmentDependencies): ClientTokenEnrollment {
  let onEnrolled: ((identity: ClientIdentity) => void) | null = null;
  const scheduler = createRetryScheduler({
    maxRetrySeconds: config.retryMaxSeconds,
    minRetrySeconds: config.retryMinSeconds,
    onNextAttemptChange: (nextAttemptAt) => status.update({ nextAttemptAt }),
  });

  return {
    start(handler): void {
      onEnrolled = handler;
      scheduler.start();
      scheduleEnrollment(0);
    },
    stop(): void {
      scheduler.stop();
    },
  };

  function scheduleEnrollment(delaySeconds: number): void {
    scheduler.schedule(async () => {
      status.update({ lastError: null, state: "connecting" });

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

        status.update({ clientId: identity.clientId, state: "persisting_identity" });
        await persistIdentity(identity);
      } catch (error) {
        handleFailure(error);
      }
    }, delaySeconds);
  }

  async function persistIdentity(identity: ClientIdentity): Promise<void> {
    try {
      await identityStore.save(identity);
      scheduler.resetBackoff();
      console.info(`Client enrollment completed for ${identity.clientId}`);
      onEnrolled?.(identity);
    } catch (error) {
      const message = readErrorMessage(error);

      status.update({ lastError: message, state: "persisting_identity" });
      console.error(`Unable to persist client identity; retrying: ${message}`);
      scheduler.schedule(() => persistIdentity(identity), scheduler.nextRetryDelay());
    }
  }

  function handleFailure(error: unknown): void {
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

    const serverDelay = error instanceof ServerApiError ? error.retryAfterSeconds : null;
    const delaySeconds = scheduler.nextRetryDelay(serverDelay);

    status.update({ lastError: message, state: "disconnected" });
    console.warn(`Client enrollment failed; retrying in ${delaySeconds}s: ${message}`);
    scheduleEnrollment(delaySeconds);
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client enrollment error";
}
