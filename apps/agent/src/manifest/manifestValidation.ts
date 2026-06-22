import type { Manifest, ManifestItem } from "../../../shared/contracts.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const manifest = value as Partial<Manifest>;

  return (
    typeof manifest.id === "string" &&
    manifest.id.length > 0 &&
    typeof manifest.name === "string" &&
    Number.isSafeInteger(manifest.version) &&
    typeof manifest.version === "number" &&
    manifest.version > 0 &&
    Array.isArray(manifest.items) &&
    manifest.items.length > 0 &&
    manifest.items.every(isManifestItem)
  );
}

function isManifestItem(value: unknown): value is ManifestItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<ManifestItem>;

  if (
    typeof item.id !== "string" ||
    item.id.length === 0 ||
    !Number.isSafeInteger(item.durationSeconds) ||
    typeof item.durationSeconds !== "number" ||
    item.durationSeconds <= 0
  ) {
    return false;
  }

  if (item.type === "image" || item.type === "video") {
    return (
      typeof item.assetId === "string" &&
      item.assetId.length > 0 &&
      (item.fit === "contain" || item.fit === "cover") &&
      isSafeLocalAssetPath(item.localPath) &&
      typeof item.remoteUrl === "string" &&
      item.remoteUrl.length > 0 &&
      typeof item.sha256 === "string" &&
      SHA256_PATTERN.test(item.sha256)
    );
  }

  if (item.type === "text") {
    return typeof item.text === "string";
  }

  return (
    item.type === "live_web_link" &&
    isHttpUrl(item.url) &&
    Number.isSafeInteger(item.refreshSeconds) &&
    typeof item.refreshSeconds === "number" &&
    item.refreshSeconds > 0
  );
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeLocalAssetPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/assets/")) {
    return false;
  }

  if (value.includes("\\") || value.includes("?") || value.includes("#")) {
    return false;
  }

  try {
    const decodedSegments = value
      .slice("/assets/".length)
      .split("/")
      .map((segment) => decodeURIComponent(segment));

    return decodedSegments.every((segment) => segment.length > 0 && segment !== "..");
  } catch {
    return false;
  }
}
