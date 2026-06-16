import type { Manifest } from "../../../shared/contracts.js";
import type {
  SyncNotificationPhase,
  SyncNotificationProgress,
  SyncNotificationSnapshot,
} from "../../../shared/localDisplayContracts.js";

const DISPLAYED_SUCCESS_NOTIFICATION_MS = 1000;

interface ManifestNotificationDetails {
  detail?: string | null;
  manifest: Manifest;
  progress?: SyncNotificationProgress | null;
}

interface FailureNotificationDetails {
  detail?: string | null;
  error: string;
  manifest?: Manifest | null;
}

export interface SyncNotificationManager {
  clear(): void;
  getSnapshot(): SyncNotificationSnapshot | null;
  markDisplayed(manifest: Manifest): void;
  showActivating(details: ManifestNotificationDetails): void;
  showAssignmentReceived(details: ManifestNotificationDetails): void;
  showChecking(details: ManifestNotificationDetails): void;
  showDownload(details: ManifestNotificationDetails): void;
  showFailure(details: FailureNotificationDetails): void;
  showVerifying(details: ManifestNotificationDetails): void;
  showWaitingForDisplay(details: ManifestNotificationDetails): void;
}

export function createSyncNotificationManager(): SyncNotificationManager {
  let currentNotification: SyncNotificationSnapshot | null = null;
  let sequence = 0;

  return {
    clear(): void {
      currentNotification = null;
    },

    getSnapshot(): SyncNotificationSnapshot | null {
      if (!currentNotification) {
        return null;
      }

      if (hasExpired(currentNotification)) {
        currentNotification = null;
        return null;
      }

      return { ...currentNotification };
    },

    markDisplayed(manifest: Manifest): void {
      if (!currentNotification || !doesNotificationMatchManifest(currentNotification, manifest)) {
        return;
      }

      setTransientNotification({
        detail: createManifestDetail(manifest),
        level: "success",
        manifest,
        message: "The new content is now visible on this display.",
        phase: "success",
        progress: { completedItems: 1, totalItems: 1 },
        title: "Display content shown",
      });
    },

    showActivating(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "Preparing the verified content for display.",
        phase: "activating",
        progress: details.progress ?? null,
        title: "Activating display content",
      });
    },

    showAssignmentReceived(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "The server sent a new display assignment.",
        phase: "assignment_received",
        progress: details.progress ?? null,
        title: "New display assignment received",
      });
    },

    showChecking(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "Checking the local cache before updating the display.",
        phase: "checking",
        progress: details.progress ?? null,
        title: "Checking display content",
      });
    },

    showDownload(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "Downloading content to the local cache.",
        phase: "downloading",
        progress: details.progress ?? null,
        title: "Downloading display content",
      });
    },

    showFailure(details: FailureNotificationDetails): void {
      currentNotification = createNotification({
        detail: details.detail ?? null,
        expiresAt: null,
        level: "error",
        manifest: details.manifest ?? null,
        message: details.error,
        phase: "failed",
        progress: null,
        title: "Display sync failed",
      });
    },

    showVerifying(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "Verifying downloaded content before activation.",
        phase: "verifying",
        progress: details.progress ?? null,
        title: "Verifying display content",
      });
    },

    showWaitingForDisplay(details: ManifestNotificationDetails): void {
      setActiveNotification({
        detail: details.detail ?? createManifestDetail(details.manifest),
        manifest: details.manifest,
        message: "Content is ready. Waiting for the screen to render it.",
        phase: "displaying",
        progress: details.progress ?? null,
        title: "Displaying new content",
      });
    },
  };

  function setActiveNotification(details: {
    detail: string | null;
    manifest: Manifest;
    message: string;
    phase: SyncNotificationPhase;
    progress: SyncNotificationProgress | null;
    title: string;
  }): void {
    currentNotification = createNotification({
      ...details,
      expiresAt: null,
      level: "info",
    });
  }

  function setTransientNotification(details: {
    detail: string | null;
    level: "error" | "success";
    manifest: Manifest | null;
    message: string;
    phase: SyncNotificationPhase;
    progress: SyncNotificationProgress | null;
    title: string;
  }): void {
    currentNotification = createNotification({
      ...details,
      expiresAt: new Date(Date.now() + DISPLAYED_SUCCESS_NOTIFICATION_MS).toISOString(),
    });
  }

  function createNotification(details: {
    detail: string | null;
    expiresAt: string | null;
    level: "error" | "info" | "success";
    manifest: Manifest | null;
    message: string;
    phase: SyncNotificationPhase;
    progress: SyncNotificationProgress | null;
    title: string;
  }): SyncNotificationSnapshot {
    sequence += 1;

    return {
      detail: details.detail,
      expiresAt: details.expiresAt,
      id: `sync-notification-${sequence}`,
      level: details.level,
      manifestId: details.manifest?.id ?? null,
      manifestName: details.manifest?.name ?? null,
      manifestVersion: details.manifest?.version ?? null,
      message: details.message,
      phase: details.phase,
      progress: details.progress,
      title: details.title,
      updatedAt: new Date().toISOString(),
    };
  }
}

function createManifestDetail(manifest: Manifest): string {
  return `${manifest.name} (${manifest.id})`;
}

function doesNotificationMatchManifest(
  notification: SyncNotificationSnapshot,
  manifest: Manifest,
): boolean {
  return (
    notification.manifestId === manifest.id && notification.manifestVersion === manifest.version
  );
}

function hasExpired(notification: SyncNotificationSnapshot): boolean {
  return notification.expiresAt !== null && Date.now() > Date.parse(notification.expiresAt);
}
