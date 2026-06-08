import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

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
      try {
        const identity = JSON.parse(await readFile(identityPath, "utf8")) as unknown;

        if (!isClientIdentity(identity)) {
          throw new Error(`Client identity file is invalid: ${identityPath}`);
        }

        return identity;
      } catch (error) {
        if (hasErrorCode(error, "ENOENT")) {
          return null;
        }

        throw error;
      }
    },

    async save(identity: ClientIdentity): Promise<void> {
      const temporaryPath = `${identityPath}.${process.pid}.tmp`;
      let fileHandle: Awaited<ReturnType<typeof open>> | null = null;

      try {
        fileHandle = await open(temporaryPath, "wx", 0o600);
        await fileHandle.writeFile(`${JSON.stringify(identity, null, 2)}\n`, "utf8");
        await fileHandle.sync();
        await fileHandle.close();
        fileHandle = null;
        await rename(temporaryPath, identityPath);
        await syncDirectory(path.dirname(identityPath));
      } catch (error) {
        await fileHandle?.close().catch(() => undefined);
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        throw error;
      }
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

async function syncDirectory(directoryPath: string): Promise<void> {
  const directoryHandle = await open(directoryPath, "r");

  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
