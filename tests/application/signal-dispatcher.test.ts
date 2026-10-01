import { describe, expect, it, vi } from "vitest";
import {
  dispatchSignalCheck,
  type SignalMonitorPort,
  type SignalNotifier
} from "../../src/application/signal-dispatcher.js";
import type { SignalMonitorResult } from "../../src/application/signal-monitor.js";

function createSignalResult(): SignalMonitorResult {
  return {
    newCandle: true,
    candleTimestamp: 123456789,
    signal: {
      symbol: "BTCUSDT",
      signal: {
        direction: "LONG",
        entry: 100,
        stopLoss: 95,
        takeProfits: [105, 110],
        strategy: "EMA Trend + Breakout",
        timeframe: "15m",
        reason:
          "Fast EMA is above slow EMA and price confirmed an upside breakout."
      }
    }
  };
}

describe("dispatchSignalCheck", () => {
  it("notifies and acknowledges a new signal", async () => {
    const result = createSignalResult();

    const monitor: SignalMonitorPort = {
      check: vi.fn().mockResolvedValue(result),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn().mockResolvedValue(undefined)
    };

    const response = await dispatchSignalCheck(
      monitor,
      notifier
    );

    expect(response).toBe(result);

    expect(notifier.notify).toHaveBeenCalledWith(
      result.signal
    );

    expect(monitor.markProcessed)
      .toHaveBeenCalledWith(123456789);
  });

  it("acknowledges a new candle without notifying when there is no signal", async () => {
    const result: SignalMonitorResult = {
      newCandle: true,
      candleTimestamp: 123456789,
      signal: null
    };

    const monitor: SignalMonitorPort = {
      check: vi.fn().mockResolvedValue(result),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi.fn().mockResolvedValue(undefined)
    };

    await dispatchSignalCheck(
      monitor,
      notifier
    );

    expect(notifier.notify).not.toHaveBeenCalled();

    expect(monitor.markProcessed)
      .toHaveBeenCalledWith(123456789);
  });

  it("does not acknowledge when notification delivery fails", async () => {
    const result = createSignalResult();

    const monitor: SignalMonitorPort = {
      check: vi.fn().mockResolvedValue(result),
      markProcessed: vi.fn()
    };

    const notifier: SignalNotifier = {
      notify: vi
        .fn()
        .mockRejectedValue(
          new Error("Notification failed")
        )
    };

    await expect(
      dispatchSignalCheck(
        monitor,
        notifier
      )
    ).rejects.toThrow("Notification failed");

    expect(monitor.markProcessed)
      .not.toHaveBeenCalled();
  });
});