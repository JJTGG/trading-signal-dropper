import { describe, expect, it, vi } from "vitest";
import {
  SignalScheduler
} from "../../src/application/signal-scheduler.js";
import type {
  SignalMonitorPort,
  SignalNotifier
} from "../../src/application/signal-dispatcher.js";
import type {
  SignalMonitorResult
} from "../../src/application/signal-monitor.js";

function createResult(
  candleTimestamp: number
): SignalMonitorResult {
  return {
    newCandle: true,
    candleTimestamp,
    signal: null
  };
}

describe("SignalScheduler", () => {
  it("runs checks sequentially and waits between cycles", async () => {
    const monitor: SignalMonitorPort = {
      check: vi
        .fn()
        .mockResolvedValueOnce(createResult(1))
        .mockImplementationOnce(async () => {
          scheduler.stop();

          return createResult(2);
        }),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn()
    };

    const sleep = vi.fn(
      async (_milliseconds: number) => {}
    );

    const scheduler = new SignalScheduler(
      monitor,
      notifier,
      {
        intervalMs: 5_000,
        sleep
      }
    );

    await scheduler.start();

    expect(monitor.check).toHaveBeenCalledTimes(2);

    expect(monitor.markProcessed)
      .toHaveBeenNthCalledWith(1, 1);

    expect(monitor.markProcessed)
      .toHaveBeenNthCalledWith(2, 2);

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(5_000);

    expect(scheduler.isRunning()).toBe(false);
  });

  it("continues polling after a failed check", async () => {
    const error = new Error("Temporary failure");

    const monitor: SignalMonitorPort = {
      check: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockImplementationOnce(async () => {
          scheduler.stop();

          return createResult(2);
        }),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn()
    };

    const onError = vi.fn();

    const sleep = vi.fn(
      async (_milliseconds: number) => {}
    );

    const scheduler = new SignalScheduler(
      monitor,
      notifier,
      {
        intervalMs: 1_000,
        sleep,
        onError
      }
    );

    await scheduler.start();

    expect(onError).toHaveBeenCalledWith(error);
    expect(monitor.check).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);

    expect(monitor.markProcessed)
      .toHaveBeenCalledWith(2);
  });

  it("rejects an invalid polling interval", () => {
    const monitor: SignalMonitorPort = {
      check: vi.fn(),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn()
    };

    expect(
      () =>
        new SignalScheduler(
          monitor,
          notifier,
          {
            intervalMs: 0
          }
        )
    ).toThrow(
      "Polling interval must be greater than zero."
    );

    expect(
      () =>
        new SignalScheduler(
          monitor,
          notifier,
          {
            intervalMs: -1
          }
        )
    ).toThrow(
      "Polling interval must be greater than zero."
    );
  });

  it("does not allow the scheduler to start twice", async () => {
    let releaseCheck:
      (() => void) | undefined;

    const checkStarted =
      new Promise<void>((resolve) => {
        releaseCheck = resolve;
      });

    const monitor: SignalMonitorPort = {
      check: vi.fn().mockImplementation(
        async () => {
          await checkStarted;

          return createResult(1);
        }
      ),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn()
    };

    const scheduler = new SignalScheduler(
      monitor,
      notifier,
      {
        intervalMs: 1_000
      }
    );

    const firstStart = scheduler.start();

    expect(scheduler.isRunning()).toBe(true);

    await expect(
      scheduler.start()
    ).rejects.toThrow(
      "Signal scheduler is already running."
    );

    scheduler.stop();

    releaseCheck?.();

    await firstStart;

    expect(scheduler.isRunning()).toBe(false);
    expect(monitor.check).toHaveBeenCalledTimes(1);
  });
});