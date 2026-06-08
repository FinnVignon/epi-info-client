import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { Manifest } from "../../../shared/contracts.js";
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

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const manifest = value as Partial<Manifest>;

  return (
    typeof manifest.id === "string" &&
    manifest.id.length > 0 &&
    typeof manifest.name === "string" &&
    Number.isSafeInteger(manifest.version) &&
    Array.isArray(manifest.items)
  );
}
