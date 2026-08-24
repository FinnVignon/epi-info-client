export type LocalClientPairingState = "error" | "idle" | "pending" | "rejected" | "requesting";

export interface LocalClientPairingSnapshot {
  expiresAt: string | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  state: LocalClientPairingState;
  userCode: string | null;
}

export const LOCAL_FALLBACK_MANIFEST_ID = "local-fallback";
