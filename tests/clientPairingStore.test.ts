import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createClientPairingStore } from "../apps/agent/src/storage/clientPairingStore.js";

describe("client pairing store", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    );
  });

  it("persists a resumable private pairing with owner-only permissions", async () => {
    const directory = await createTemporaryDirectory();
    const pairingPath = path.join(directory, "client-pairing.json");
    const store = createClientPairingStore(pairingPath);
    const pairing = {
      deviceCode: "d".repeat(43),
      expiresAt: "2026-12-01T12:00:00.000Z",
      pollIntervalSeconds: 5,
      userCode: "ABCD-2345",
    };

    await store.save(pairing);

    expect(await store.load()).toEqual(pairing);
    expect((await stat(pairingPath)).mode & 0o777).toBe(0o600);
    expect(await readFile(pairingPath, "utf8")).toContain('"deviceCode"');
  });

  it("clears consumed pairings", async () => {
    const directory = await createTemporaryDirectory();
    const pairingPath = path.join(directory, "client-pairing.json");
    const store = createClientPairingStore(pairingPath);

    await store.save({
      deviceCode: "d".repeat(43),
      expiresAt: "2026-12-01T12:00:00.000Z",
      pollIntervalSeconds: 5,
      userCode: "ABCD-2345",
    });
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "epi-info-pairing-"));

    temporaryDirectories.push(directory);
    return directory;
  }
});
