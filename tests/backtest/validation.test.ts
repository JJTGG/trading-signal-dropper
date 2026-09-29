import { describe, expect, it } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import { validateStrategy } from "../../src/backtest/validation.js";
import type { Strategy } from "../../src/strategy/strategy.js";

const candles: Candle[] = Array.from(
  { length: 10 },
  (_, index) => ({
    timestamp: index,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100 + index,
    volume: 1000
  })
);

const strategy: Strategy = {
  name: "Test Strategy",

  evaluate() {
    return null;
  }
};

describe("validateStrategy", () => {
  it("runs a strategy through the backtester and metrics pipeline", () => {
    const result = validateStrategy(candles, strategy);

    expect(result.candles).toBe(10);
    expect(result.backtest.trades).toHaveLength(0);
    expect(result.metrics.totalTrades).toBe(0);
    expect(result.metrics.totalR).toBe(0);
  });
});