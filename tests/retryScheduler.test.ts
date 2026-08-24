import { afterEach, describe, expect, it, vi } from "vitest";

import { createRetryScheduler } from "../apps/agent/src/connection/retryScheduler.js";

describe("retry scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("backs off, honors server delays, and resets", () => {
    const scheduler = createScheduler();

    expect(scheduler.nextRetryDelay()).toBe(5);
    expect(scheduler.nextRetryDelay()).toBe(10);
    expect(scheduler.nextRetryDelay(7)).toBe(7);
    expect(scheduler.nextRetryDelay()).toBe(20);
    scheduler.resetBackoff();
    expect(scheduler.nextRetryDelay()).toBe(5);
  });

  it("runs scheduled work only while started", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    const nextAttempts: Array<string | null> = [];
    const scheduler = createScheduler((nextAttemptAt) => nextAttempts.push(nextAttemptAt));
    const task = vi.fn();

    scheduler.start();
    scheduler.schedule(task, 5);
    expect(nextAttempts[0]).toBe("2026-08-01T12:00:05.000Z");
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(task).not.toHaveBeenCalled();

    scheduler.start();
    scheduler.schedule(task, 1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledOnce();
  });
});

function createScheduler(onNextAttemptChange: (value: string | null) => void = () => undefined) {
  return createRetryScheduler({
    maxRetrySeconds: 60,
    minRetrySeconds: 5,
    onNextAttemptChange,
  });
}
