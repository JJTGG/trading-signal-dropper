import { describe, expect, it } from "vitest";
import type { Candle, SignalCandidate } from "../../src/domain/types.js";
import { runBacktest } from "../../src/backtest/backtester.js";
import type { Strategy } from "../../src/strategy/strategy.js";

const signal: SignalCandidate = {
  direction: "LONG",
  entry: 100,
  stopLoss: 98,
  takeProfits: [102],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test signal"
};

const strategy: Strategy = {
  name: "Test Strategy",

  evaluate(candles: Candle[]) {
    if (candles.length === 2) {
      return signal;
    }

    return null;
  }
};

const candles: Candle[] = [
  {
    timestamp: 1,
    open: 100,
    high: 101,
    low: 99,
    close: 100
  },
  {
    timestamp: 2,
    open: 100,
    high: 101,
    low: 99,
    close: 100
  },
  {
    timestamp: 3,
    open: 100,
    high: 103,
    low: 100,
    close: 102
  }
];

describe("runBacktest", () => {
  it("runs a strategy against future candles", () => {
    const result = runBacktest(candles, strategy);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.outcome).toBe("WIN");
    expect(result.trades[0]?.rMultiple).toBe(1);
    expect(result.trades[0]?.entryTimestamp).toBe(2);
  });
});