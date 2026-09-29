import { describe, expect, it } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import { validateStrategy } from "../../src/backtest/validation.js";
import { EmaBreakoutStrategy } from "../../src/strategy/ema-breakout.js";

function createHistoricalCandles(): Candle[] {
  const candles: Candle[] = [];

  for (let i = 0; i < 50; i += 1) {
    const close = 100 + i;

    candles.push({
      timestamp: i,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000
    });
  }

  // Breakout candle.
  candles.push({
    timestamp: 50,
    open: 149.5,
    high: 154,
    low: 149,
    close: 153,
    volume: 1000
  });

  // Future candle after the breakout.
  candles.push({
    timestamp: 51,
    open: 153,
    high: 154,
    low: 152,
    close: 153.5,
    volume: 1000
  });

  // Future candle reaches the second take-profit.
  candles.push({
    timestamp: 52,
    open: 153.5,
    high: 160,
    low: 153,
    close: 157,
    volume: 1000
  });

  return candles;
}

describe("validateStrategy", () => {
  it("runs the EMA breakout strategy through the full validation pipeline", () => {
    const candles = createHistoricalCandles();
    const strategy = new EmaBreakoutStrategy();

    const result = validateStrategy(candles, strategy);

    expect(result.candles).toBe(53);
    expect(result.backtest.trades.length).toBeGreaterThan(0);
    expect(result.metrics.totalTrades).toBeGreaterThan(0);
    expect(result.metrics.winningTrades).toBeGreaterThan(0);
    expect(result.metrics.totalR).toBeGreaterThan(0);

    const firstTrade = result.backtest.trades[0];

    expect(firstTrade).toBeDefined();
    expect(firstTrade?.signal.direction).toBe("LONG");
    expect(firstTrade?.signal.strategy).toBe(
      "EMA Trend + Breakout"
    );
  });
});