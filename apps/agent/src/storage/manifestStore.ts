import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";

import type { Manifest } from "../../../shared/contracts.js";
import { isManifest } from "../manifest/manifestValidation.js";
import type { ClientPaths } from "./clientPaths.js";

const FALLBACK_MANIFEST: Manifest = {
  id: "local-fallback",
  items: [
    {
      durationSeconds: 30,
      id: "fallback-text",
      text: "No manifest assigned",
      type: "text",
    },
  ],
  name: "Local fallback",
  version: 1,
};

export interface ManifestStore {
  activateManifest(manifest: Manifest): Promise<void>;
  getActiveManifest(): Manifest;
}

export function createManifestStore(paths: ClientPaths): ManifestStore {
  mkdirSync(paths.assetsPath, { recursive: true });
  mkdirSync(paths.manifestsPath, { recursive: true });

  if (!existsSync(paths.activeManifestPath)) {
    writeFileSync(
      paths.activeManifestPath,
      `${JSON.stringify(FALLBACK_MANIFEST, null, 2)}\n`,
      "utf8",
    );
  }

  return {
    async activateManifest(manifest: Manifest): Promise<void> {
      const temporaryManifestPath = `${paths.activeManifestPath}.tmp`;

      await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o644,
      });
      await rename(temporaryManifestPath, paths.activeManifestPath);
    },

    getActiveManifest(): Manifest {
      try {
        const manifest = JSON.parse(readFileSync(paths.activeManifestPath, "utf8")) as unknown;

        return isManifest(manifest) ? manifest : FALLBACK_MANIFEST;
      } catch {
        return FALLBACK_MANIFEST;
      }
    },
  };
}
