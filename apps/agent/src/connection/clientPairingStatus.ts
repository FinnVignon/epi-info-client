import type {
  LocalClientPairingSnapshot,
  LocalClientPairingState,
} from "../../../shared/localPairingContracts.js";

export interface ClientPairingStatus {
  getSnapshot(): LocalClientPairingSnapshot;
  reset(): void;
  update(state: LocalClientPairingState, update?: Partial<LocalClientPairingSnapshot>): void;
}

const INITIAL_PAIRING_STATUS: LocalClientPairingSnapshot = {
  expiresAt: null,
  lastError: null,
  nextAttemptAt: null,
  state: "idle",
  userCode: null,
};

export function createClientPairingStatus(): ClientPairingStatus {
  let snapshot = { ...INITIAL_PAIRING_STATUS };

  return {
    getSnapshot(): LocalClientPairingSnapshot {
      return { ...snapshot };
    },
    reset(): void {
      snapshot = { ...INITIAL_PAIRING_STATUS };
    },
    update(state, update = {}): void {
      snapshot = { ...snapshot, ...update, state };
    },
  };
}
