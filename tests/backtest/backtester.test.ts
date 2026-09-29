import { describe, expect, it } from "vitest";
import type {
  Candle,
  SignalCandidate
} from "../../src/domain/types.js";
import type { Strategy } from "../../src/strategy/strategy.js";
import { runBacktest } from "../../src/backtest/backtester.js";

const candles: Candle[] = [
  {
    timestamp: 0,
    open: 100,
    high: 101,
    low: 99,
    close: 100
  },
  {
    timestamp: 1,
    open: 100,
    high: 103,
    low: 99,
    close: 102
  },
  {
    timestamp: 2,
    open: 102,
    high: 105,
    low: 101,
    close: 104
  },
  {
    timestamp: 3,
    open: 104,
    high: 106,
    low: 103,
    close: 105
  }
];

const signal: SignalCandidate = {
  direction: "LONG",
  entry: 100,
  stopLoss: 98,
  takeProfits: [102, 104],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test signal"
};

describe("runBacktest", () => {
  it("runs a strategy against future candles", () => {
    const strategy: Strategy = {
      name: "Test",

      evaluate(availableCandles) {
        if (availableCandles.length !== 1) {
          return null;
        }

        return signal;
      }
    };

    const result = runBacktest(candles, strategy);

    expect(result.trades).toHaveLength(1);
    expect(result.unresolvedSignals).toHaveLength(0);

    expect(result.trades[0]).toMatchObject({
      signal,
      entryPrice: 100,
      exitPrice: 104,
      outcome: "WIN",
      rMultiple: 1.5,
      entryTimestamp: 0,
      exitTimestamp: 2
    });
  });

  it("tracks signals that remain unresolved", () => {
    const unresolvedSignal: SignalCandidate = {
      ...signal
    };

    const strategy: Strategy = {
      name: "Test",

      evaluate(availableCandles) {
        if (availableCandles.length !== 3) {
          return null;
        }

        return unresolvedSignal;
      }
    };

    const result = runBacktest(candles, strategy);

    expect(result.trades).toHaveLength(0);
    expect(result.unresolvedSignals).toHaveLength(1);

    expect(result.unresolvedSignals[0]).toEqual({
      signal: unresolvedSignal,
      signalTimestamp: 2
    });
  });
});