import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createClientIdentityStore } from "../apps/agent/src/storage/clientIdentityStore.js";

describe("client identity store", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("atomically persists and loads a private client identity", async () => {
    const identityPath = await createIdentityPath();
    const store = createClientIdentityStore(identityPath);
    const identity = {
      clientId: "client-1",
      clientSecret: "s".repeat(32),
      enrolledAt: "2026-01-01T00:00:00.000Z",
    };

    await expect(store.load()).resolves.toBeNull();
    await store.save(identity);

    await expect(store.load()).resolves.toEqual(identity);
    expect((await stat(identityPath)).mode & 0o777).toBe(0o600);
  });

  it("rejects an invalid identity file", async () => {
    const identityPath = await createIdentityPath();
    await writeFile(identityPath, JSON.stringify({ clientId: "client-1" }));

    await expect(createClientIdentityStore(identityPath).load()).rejects.toThrow(
      "Client identity file is invalid",
    );
  });

  async function createIdentityPath(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "epi-info-identity-"));
    temporaryDirectories.push(directory);

    return path.join(directory, "client-identity.json");
  }
});
