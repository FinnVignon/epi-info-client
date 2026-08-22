import { afterEach, describe, expect, it, vi } from "vitest";

import type { Manifest } from "../apps/shared/contracts.js";
import { createSyncNotificationManager } from "../apps/agent/src/connection/syncNotifications.js";

const manifest: Manifest = {
  id: "manifest-1",
  items: [
    {
      durationSeconds: 30,
      id: "link-1",
      refreshSeconds: 60,
      type: "live_web_link",
      url: "https://example.com",
    },
  ],
  name: "Status",
  version: 1,
};

describe("sync notifications", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps progress visible until content is displayed", () => {
    const manager = createSyncNotificationManager();

    manager.showAssignmentSignal();
    expect(manager.getSnapshot()?.phase).toBe("assignment_signal_received");
    manager.showAssignmentReceived({ manifest });
    expect(manager.getSnapshot()?.phase).toBe("assignment_received");
    manager.showWaitingForDisplay({ manifest });
    expect(manager.getSnapshot()?.phase).toBe("displaying");
  });

  it("shows success for one second after the matching manifest is displayed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const manager = createSyncNotificationManager();
    manager.showWaitingForDisplay({ manifest });
    manager.markDisplayed(manifest);

    expect(manager.getSnapshot()?.phase).toBe("success");
    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect(manager.getSnapshot()).toBeNull();
  });

  it("does not mark a different manifest as displayed", () => {
    const manager = createSyncNotificationManager();
    manager.showWaitingForDisplay({ manifest });
    manager.markDisplayed({ ...manifest, id: "manifest-2" });

    expect(manager.getSnapshot()?.phase).toBe("displaying");
  });

  it("keeps failures visible for diagnosis", () => {
    const manager = createSyncNotificationManager();
    manager.showFailure({ error: "Network unavailable", manifest });

    expect(manager.getSnapshot()).toMatchObject({
      level: "error",
      message: "Network unavailable",
      phase: "failed",
    });
  });
});
