export interface RetryScheduler {
  nextRetryDelay(explicitDelaySeconds?: number | null): number;
  resetBackoff(): void;
  schedule(
    task: () => void | Promise<void>,
    delaySeconds: number,
    minimumDelaySeconds?: number,
  ): void;
  start(): void;
  stop(): void;
}

interface RetrySchedulerOptions {
  maxRetrySeconds: number;
  minRetrySeconds: number;
  onNextAttemptChange(nextAttemptAt: string | null): void;
}

export function createRetryScheduler(options: RetrySchedulerOptions): RetryScheduler {
  let retrySeconds = options.minRetrySeconds;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  return {
    nextRetryDelay(explicitDelaySeconds = null): number {
      if (explicitDelaySeconds) {
        return explicitDelaySeconds;
      }

      const currentDelay = retrySeconds;

      retrySeconds = Math.min(options.maxRetrySeconds, retrySeconds * 2);
      return currentDelay;
    },
    resetBackoff(): void {
      retrySeconds = options.minRetrySeconds;
    },
    schedule(task, delaySeconds, minimumDelaySeconds = 0): void {
      if (!running) {
        return;
      }

      clearTimer();
      const delay = Math.max(minimumDelaySeconds, delaySeconds);

      options.onNextAttemptChange(new Date(Date.now() + delay * 1000).toISOString());
      timer = setTimeout(() => {
        timer = null;
        options.onNextAttemptChange(null);

        if (running) {
          void task();
        }
      }, delay * 1000);
    },
    start(): void {
      running = true;
    },
    stop(): void {
      running = false;
      clearTimer();
      options.onNextAttemptChange(null);
    },
  };

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
}
