import type { Manifest } from "../../../shared/contracts";
import type { SyncNotificationSnapshot } from "../../../shared/localDisplayContracts";

export async function acknowledgeDisplayedManifest(manifest: Manifest): Promise<boolean> {
  const response = await fetch("/api/manifest/displayed", {
    body: JSON.stringify({
      manifestId: manifest.id,
      manifestVersion: manifest.version,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return response.ok;
}

export async function loadActiveManifest(): Promise<Manifest> {
  const response = await fetch("/api/manifest", { cache: "no-store" });

  return (await response.json()) as Manifest;
}

export async function loadSyncNotification(): Promise<SyncNotificationSnapshot | null> {
  const response = await fetch("/api/sync/notification", { cache: "no-store" });
  const body = (await response.json()) as unknown;

  return isSyncNotificationSnapshot(body) ? body : null;
}

function isSyncNotificationSnapshot(value: unknown): value is SyncNotificationSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const notification = value as Partial<SyncNotificationSnapshot>;

  return (
    typeof notification.id === "string" &&
    typeof notification.title === "string" &&
    typeof notification.message === "string" &&
    (typeof notification.manifestVersion === "number" ||
      notification.manifestVersion === null ||
      notification.manifestVersion === undefined) &&
    (notification.level === "error" ||
      notification.level === "info" ||
      notification.level === "success")
  );
}
