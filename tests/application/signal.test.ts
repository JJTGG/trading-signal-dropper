import { describe, expect, it, vi } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import type { HistoricalDataProvider } from "../../src/data/historical.js";
import { generateSignal } from "../../src/application/signal.js";

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: index + 1,
    open: close,
    high: close + 1,
    low: close - 1,
    close
  }));
}

describe("generateSignal", () => {
  it("generates a signal through the injected data provider", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn().mockResolvedValue(
        createCandles([
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          111
        ])
      )
    };

    const result = await generateSignal(provider, {
      symbol: "btcusdt",
      timeframe: "15m"
    });

    expect(provider.getCandles).toHaveBeenCalledWith({
      symbol: "btcusdt",
      timeframe: "15m",
      limit: 100
    });

    expect(result).not.toBeNull();
    expect(result?.symbol).toBe("BTCUSDT");
    expect(result?.signal.direction).toBe("LONG");
  });

  it("returns null when the strategy produces no signal", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn().mockResolvedValue(
        createCandles([
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          108.5
        ])
      )
    };

    const result = await generateSignal(provider, {
      symbol: "BTCUSDT"
    });

    expect(result).toBeNull();
  });

  it("rejects an empty symbol", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn()
    };

    await expect(
      generateSignal(provider, {
        symbol: ""
      })
    ).rejects.toThrow("Symbol is required.");

    expect(provider.getCandles).not.toHaveBeenCalled();
  });
});