import { describe, expect, it } from "vitest";
import type { SignalCandidate } from "../../src/domain/types.js";
import type { SimulatedTrade } from "../../src/backtest/trade-simulator.js";
import { calculateMetrics } from "../../src/backtest/metrics.js";

const signal: SignalCandidate = {
  direction: "LONG",
  entry: 100,
  stopLoss: 98,
  takeProfits: [102],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test"
};

function trade(
  rMultiple: number,
  timestamp: number
): SimulatedTrade {
  return {
    signal,
    entryPrice: 100,
    exitPrice: rMultiple > 0 ? 102 : 98,
    outcome: rMultiple > 0 ? "WIN" : "LOSS",
    rMultiple,
    entryTimestamp: timestamp,
    exitTimestamp: timestamp + 1
  };
}

describe("calculateMetrics", () => {
  it("calculates complete performance metrics", () => {
    const trades = [
      trade(1, 1),
      trade(1, 2),
      trade(-1, 3),
      trade(-1, 4),
      trade(1, 5)
    ];

    const metrics = calculateMetrics(trades);

    expect(metrics.totalTrades).toBe(5);
    expect(metrics.winningTrades).toBe(3);
    expect(metrics.losingTrades).toBe(2);

    expect(metrics.winRate).toBeCloseTo(0.6);

    expect(metrics.averageR).toBeCloseTo(0.2);
    expect(metrics.totalR).toBeCloseTo(1);

    expect(metrics.profitFactor).toBeCloseTo(1.5);

    expect(metrics.maximumDrawdown).toBeCloseTo(2);

    expect(metrics.largestWinningTrade).toBe(1);
    expect(metrics.largestLosingTrade).toBe(-1);

    expect(metrics.longestWinningStreak).toBe(2);
    expect(metrics.longestLosingStreak).toBe(2);
  });

  it("handles an empty trade set", () => {
    const metrics = calculateMetrics([]);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.averageR).toBe(0);
    expect(metrics.totalR).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.maximumDrawdown).toBe(0);
  });

  it("reports infinite profit factor when there are wins but no losses", () => {
    const metrics = calculateMetrics([
      trade(1, 1),
      trade(2, 2)
    ]);

    expect(metrics.profitFactor).toBe(Infinity);
  });
});