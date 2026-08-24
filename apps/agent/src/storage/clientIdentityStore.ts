import { readJsonFile, writeJsonFileAtomically } from "./atomicJsonFile.js";

export interface ClientIdentity {
  clientId: string;
  clientSecret: string;
  enrolledAt: string;
}

export interface ClientIdentityStore {
  load(): Promise<ClientIdentity | null>;
  save(identity: ClientIdentity): Promise<void>;
}

export function createClientIdentityStore(identityPath: string): ClientIdentityStore {
  return {
    async load(): Promise<ClientIdentity | null> {
      const identity = await readJsonFile(identityPath);

      if (identity !== null && !isClientIdentity(identity)) {
        throw new Error(`Client identity file is invalid: ${identityPath}`);
      }

      return identity;
    },

    async save(identity: ClientIdentity): Promise<void> {
      await writeJsonFileAtomically(identityPath, identity);
    },
  };
}

function isClientIdentity(value: unknown): value is ClientIdentity {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const identity = value as Partial<ClientIdentity>;

  return (
    typeof identity.clientId === "string" &&
    identity.clientId.length > 0 &&
    typeof identity.clientSecret === "string" &&
    identity.clientSecret.length >= 32 &&
    typeof identity.enrolledAt === "string" &&
    !Number.isNaN(Date.parse(identity.enrolledAt))
  );
}
