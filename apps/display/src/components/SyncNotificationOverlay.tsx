import type { SyncNotificationSnapshot } from "../../../shared/localDisplayContracts";

interface SyncNotificationOverlayProps {
  notification: SyncNotificationSnapshot | null;
}

export function SyncNotificationOverlay({ notification }: SyncNotificationOverlayProps) {
  if (!notification) {
    return null;
  }

  const progressPercent = notification.progress
    ? Math.round(
        (notification.progress.completedItems / Math.max(1, notification.progress.totalItems)) *
          100,
      )
    : null;

  return (
    <aside className={`sync-notification ${notification.level}`} role="status">
      <div className="sync-notification-header">
        <span>{notification.title}</span>
        {notification.progress ? (
          <small>
            {notification.progress.completedItems}/{notification.progress.totalItems}
          </small>
        ) : null}
      </div>
      <p>{notification.message}</p>
      {notification.detail ? (
        <small className="sync-notification-detail">{notification.detail}</small>
      ) : null}
      {progressPercent !== null ? (
        <div className="sync-progress" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}
    </aside>
  );
}
