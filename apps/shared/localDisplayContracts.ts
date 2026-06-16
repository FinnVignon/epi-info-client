export type SyncNotificationLevel = "error" | "info" | "success";

export type SyncNotificationPhase =
  | "activating"
  | "assignment_received"
  | "checking"
  | "displaying"
  | "downloading"
  | "failed"
  | "success"
  | "verifying";

export interface SyncNotificationProgress {
  completedItems: number;
  totalItems: number;
}

export interface SyncNotificationSnapshot {
  detail: string | null;
  expiresAt: string | null;
  id: string;
  level: SyncNotificationLevel;
  manifestId: string | null;
  manifestName: string | null;
  manifestVersion: number | null;
  message: string;
  phase: SyncNotificationPhase;
  progress: SyncNotificationProgress | null;
  title: string;
  updatedAt: string;
}
