import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../apps/shared/contracts.js";
import { createClientPaths } from "../apps/agent/src/storage/clientPaths.js";
import { createManifestStore } from "../apps/agent/src/storage/manifestStore.js";

const assignedManifest: Manifest = {
  id: "manifest-1",
  items: [
    {
      durationSeconds: 30,
      id: "link-1",
      refreshSeconds: 60,
      type: "live_web_link",
      url: "https://example.com/status",
    },
  ],
  name: "Status",
  version: 1,
};

describe("manifest store", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("starts with a local fallback and persists activated content", async () => {
    const paths = await createPaths();
    const store = createManifestStore(paths);

    expect(store.getActiveManifest().id).toBe("local-fallback");
    await store.activateManifest(assignedManifest);
    expect(store.getActiveManifest()).toEqual(assignedManifest);
    expect(createManifestStore(paths).getActiveManifest()).toEqual(assignedManifest);
  });

  it("falls back safely when the active manifest is corrupt", async () => {
    const paths = await createPaths();
    const store = createManifestStore(paths);
    await writeFile(paths.activeManifestPath, "not JSON");

    expect(store.getActiveManifest().id).toBe("local-fallback");
  });

  async function createPaths() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "epi-info-manifest-"));
    temporaryDirectories.push(directory);

    return createClientPaths(directory);
  }
});
