import {
  dispatchSignalCheck,
  type SignalMonitorPort,
  type SignalNotifier
} from "./signal-dispatcher.js";

const DEFAULT_POLL_INTERVAL_MS = 60_000;

type SleepFunction = (
  milliseconds: number
) => Promise<void>;

export type SignalSchedulerConfig = {
  intervalMs?: number;
  sleep?: SleepFunction;
  onError?: (error: unknown) => void;
};

function defaultSleep(
  milliseconds: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function defaultOnError(error: unknown): void {
  console.error("Signal polling failed.", error);
}

export class SignalScheduler {
  private readonly intervalMs: number;
  private readonly sleep: SleepFunction;
  private readonly onError: (
    error: unknown
  ) => void;

  private running = false;
  private stopRequested = false;

  constructor(
    private readonly monitor: SignalMonitorPort,
    private readonly notifier: SignalNotifier,
    {
      intervalMs = DEFAULT_POLL_INTERVAL_MS,
      sleep = defaultSleep,
      onError = defaultOnError
    }: SignalSchedulerConfig = {}
  ) {
    if (
      !Number.isFinite(intervalMs) ||
      intervalMs <= 0
    ) {
      throw new Error(
        "Polling interval must be greater than zero."
      );
    }

    this.intervalMs = intervalMs;
    this.sleep = sleep;
    this.onError = onError;
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error(
        "Signal scheduler is already running."
      );
    }

    this.running = true;
    this.stopRequested = false;

    try {
      while (!this.stopRequested) {
        try {
          await dispatchSignalCheck(
            this.monitor,
            this.notifier
          );
        } catch (error) {
          this.onError(error);
        }

        if (this.stopRequested) {
          break;
        }

        await this.sleep(this.intervalMs);
      }
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    this.stopRequested = true;
  }

  isRunning(): boolean {
    return this.running;
  }
}