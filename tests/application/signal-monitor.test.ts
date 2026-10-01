import { describe, expect, it, vi } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import type { HistoricalDataProvider } from "../../src/data/historical.js";
import { SignalMonitor } from "../../src/application/signal-monitor.js";

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: index + 1,
    open: close,
    high: close + 1,
    low: close - 1,
    close
  }));
}

function createBullishBreakoutCandles(): Candle[] {
  const closes = Array.from(
    { length: 99 },
    (_, index) => 100 + index
  );

  closes.push(210);

  return createCandles(closes);
}

function createNonBreakoutCandles(): Candle[] {
  const closes = Array.from(
    { length: 100 },
    (_, index) => 100 + index
  );

  return createCandles(closes);
}

describe("SignalMonitor", () => {
  it("evaluates only when a new candle appears", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi
        .fn()
        .mockResolvedValueOnce([
          {
            timestamp: 200,
            open: 200,
            high: 201,
            low: 199,
            close: 200
          }
        ])
        .mockResolvedValueOnce(
          createBullishBreakoutCandles()
        )
    };

    const monitor = new SignalMonitor(provider, {
      symbol: "BTCUSDT",
      timeframe: "15m"
    });

    const result = await monitor.check();

    expect(result.newCandle).toBe(true);
    expect(result.candleTimestamp).toBe(200);
    expect(result.signal).not.toBeNull();

    expect(provider.getCandles).toHaveBeenNthCalledWith(
      1,
      {
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 1
      }
    );

    expect(provider.getCandles).toHaveBeenNthCalledWith(
      2,
      {
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 100,
        endTime: 199
      }
    );
  });

  it("does not evaluate the same candle twice", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi
        .fn()
        .mockResolvedValueOnce([
          {
            timestamp: 200,
            open: 200,
            high: 201,
            low: 199,
            close: 200
          }
        ])
        .mockResolvedValueOnce(
          createNonBreakoutCandles()
        )
        .mockResolvedValueOnce([
          {
            timestamp: 200,
            open: 200,
            high: 201,
            low: 199,
            close: 200
          }
        ])
    };

    const monitor = new SignalMonitor(provider, {
      symbol: "BTCUSDT"
    });

    const firstResult = await monitor.check();
    const secondResult = await monitor.check();

    expect(firstResult.newCandle).toBe(true);
    expect(secondResult.newCandle).toBe(false);

    expect(secondResult.candleTimestamp).toBe(200);
    expect(secondResult.signal).toBeNull();

    expect(provider.getCandles).toHaveBeenCalledTimes(3);
  });

  it("evaluates again when the candle timestamp changes", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi
        .fn()
        .mockResolvedValueOnce([
          {
            timestamp: 200,
            open: 200,
            high: 201,
            low: 199,
            close: 200
          }
        ])
        .mockResolvedValueOnce(
          createNonBreakoutCandles()
        )
        .mockResolvedValueOnce([
          {
            timestamp: 215,
            open: 215,
            high: 216,
            low: 214,
            close: 215
          }
        ])
        .mockResolvedValueOnce(
          createBullishBreakoutCandles()
        )
    };

    const monitor = new SignalMonitor(provider, {
      symbol: "BTCUSDT",
      timeframe: "15m"
    });

    const firstResult = await monitor.check();
    const secondResult = await monitor.check();

    expect(firstResult.newCandle).toBe(true);
    expect(firstResult.signal).toBeNull();

    expect(secondResult.newCandle).toBe(true);
    expect(secondResult.candleTimestamp).toBe(215);
    expect(secondResult.signal).not.toBeNull();

    expect(provider.getCandles).toHaveBeenNthCalledWith(
      4,
      {
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 100,
        endTime: 214
      }
    );
  });
});