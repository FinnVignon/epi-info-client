export type ClientConnectionState =
  | "awaiting_enrollment"
  | "connected"
  | "connecting"
  | "disconnected"
  | "enrollment_rejected"
  | "identity_error"
  | "persisting_identity";

export interface ClientConnectionSnapshot {
  clientId: string | null;
  lastError: string | null;
  lastSuccessfulHeartbeatAt: string | null;
  nextAttemptAt: string | null;
  state: ClientConnectionState;
}

export interface ClientConnectionStatus {
  getSnapshot(): ClientConnectionSnapshot;
  update(update: Partial<ClientConnectionSnapshot>): void;
}

export function createClientConnectionStatus(): ClientConnectionStatus {
  let snapshot: ClientConnectionSnapshot = {
    clientId: null,
    lastError: null,
    lastSuccessfulHeartbeatAt: null,
    nextAttemptAt: null,
    state: "connecting",
  };

  return {
    getSnapshot(): ClientConnectionSnapshot {
      return { ...snapshot };
    },
    update(update: Partial<ClientConnectionSnapshot>): void {
      snapshot = {
        ...snapshot,
        ...update,
      };
    },
  };
}
