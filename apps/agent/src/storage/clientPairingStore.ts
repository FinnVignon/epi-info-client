import { readJsonFile, removeJsonFile, writeJsonFileAtomically } from "./atomicJsonFile.js";

export interface StoredClientPairing {
  deviceCode: string;
  expiresAt: string;
  pollIntervalSeconds: number;
  userCode: string;
}

export interface ClientPairingStore {
  clear(): Promise<void>;
  load(): Promise<StoredClientPairing | null>;
  save(pairing: StoredClientPairing): Promise<void>;
}

export function createClientPairingStore(pairingPath: string): ClientPairingStore {
  return {
    async clear(): Promise<void> {
      await removeJsonFile(pairingPath);
    },
    async load(): Promise<StoredClientPairing | null> {
      const pairing = await readJsonFile(pairingPath);

      if (pairing !== null && !isStoredClientPairing(pairing)) {
        throw new Error(`Client pairing file is invalid: ${pairingPath}`);
      }

      return pairing;
    },
    async save(pairing: StoredClientPairing): Promise<void> {
      await writeJsonFileAtomically(pairingPath, pairing);
    },
  };
}

function isStoredClientPairing(value: unknown): value is StoredClientPairing {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pairing = value as Partial<StoredClientPairing>;

  return (
    typeof pairing.deviceCode === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(pairing.deviceCode) &&
    typeof pairing.userCode === "string" &&
    /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(pairing.userCode) &&
    typeof pairing.expiresAt === "string" &&
    !Number.isNaN(Date.parse(pairing.expiresAt)) &&
    Number.isSafeInteger(pairing.pollIntervalSeconds) &&
    typeof pairing.pollIntervalSeconds === "number" &&
    pairing.pollIntervalSeconds > 0
  );
}
