import { describe, expect, it, vi } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import type { HistoricalDataProvider } from "../../src/data/historical.js";
import { handleSignalCommand } from "../../src/telegram/signal.js";

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

describe("Telegram signal command", () => {
  it("requires a symbol", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn()
    };

    await expect(
      handleSignalCommand([], provider)
    ).resolves.toBe(
      [
        "Usage:",
        "/signal BTCUSDT",
        "",
        "Optional timeframe:",
        "/signal BTCUSDT 1h"
      ].join("\n")
    );

    expect(provider.getCandles).not.toHaveBeenCalled();
  });

  it("generates and formats a signal", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi
        .fn()
        .mockResolvedValue(createBullishBreakoutCandles())
    };

    const response = await handleSignalCommand(
      ["btcusdt", "15m"],
      provider
    );

    expect(provider.getCandles).toHaveBeenCalledWith({
      symbol: "btcusdt",
      timeframe: "15m",
      limit: 100
    });

    expect(response).toContain("TSD signal: LONG");
    expect(response).toContain("Symbol: BTCUSDT");
    expect(response).toContain("Timeframe: 15m");
    expect(response).toContain("Strategy: EMA Trend + Breakout");
    expect(response).toContain("Entry: 210");
  });

  it("reports when there is no signal", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn().mockResolvedValue(
        createCandles(
          Array.from(
            { length: 100 },
            (_, index) => 100 + index
          )
        )
      )
    };

    const response = await handleSignalCommand(
      ["BTCUSDT"],
      provider
    );

    expect(response).toBe(
      [
        "No signal found for BTCUSDT.",
        "Timeframe: 15m"
      ].join("\n")
    );
  });
});