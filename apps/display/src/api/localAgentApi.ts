import type { Manifest } from "../../../shared/contracts";
import type { SyncNotificationSnapshot } from "../../../shared/localDisplayContracts";
import type { LocalClientPairingSnapshot } from "../../../shared/localPairingContracts";

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

export async function loadClientPairing(): Promise<LocalClientPairingSnapshot> {
  const response = await fetch("/api/pairing", { cache: "no-store" });
  const body = (await response.json()) as unknown;

  if (!isClientPairingSnapshot(body)) {
    throw new Error("Local agent returned an invalid pairing response");
  }

  return body;
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

function isClientPairingSnapshot(value: unknown): value is LocalClientPairingSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pairing = value as Partial<LocalClientPairingSnapshot>;

  return (
    (pairing.state === "error" ||
      pairing.state === "idle" ||
      pairing.state === "pending" ||
      pairing.state === "rejected" ||
      pairing.state === "requesting") &&
    (typeof pairing.userCode === "string" || pairing.userCode === null) &&
    (typeof pairing.lastError === "string" || pairing.lastError === null) &&
    (pairing.expiresAt === null ||
      (typeof pairing.expiresAt === "string" && !Number.isNaN(Date.parse(pairing.expiresAt)))) &&
    (pairing.nextAttemptAt === null ||
      (typeof pairing.nextAttemptAt === "string" &&
        !Number.isNaN(Date.parse(pairing.nextAttemptAt))))
  );
}
