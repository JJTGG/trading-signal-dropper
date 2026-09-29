import { describe, expect, it } from "vitest";
import type { Candle, SignalCandidate } from "../../src/domain/types.js";
import { simulateTrade } from "../../src/backtest/trade-simulator.js";

const longSignal: SignalCandidate = {
  direction: "LONG",
  entry: 100,
  stopLoss: 98,
  takeProfits: [102],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test signal"
};

const shortSignal: SignalCandidate = {
  direction: "SHORT",
  entry: 100,
  stopLoss: 102,
  takeProfits: [98],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test signal"
};

function candle(
  high: number,
  low: number,
  timestamp: number
): Candle {
  return {
    timestamp,
    open: 100,
    high,
    low,
    close: 100
  };
}

describe("simulateTrade", () => {
  it("simulates a winning LONG trade", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1),
      candle(103, 100, 2)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1);
    expect(result?.exitPrice).toBe(102);
  });

  it("simulates a losing LONG trade", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1),
      candle(100, 97, 2)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(98);
  });

  it("simulates a winning SHORT trade", () => {
    const result = simulateTrade(shortSignal, [
      candle(101, 99, 1),
      candle(100, 97, 2)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1);
    expect(result?.exitPrice).toBe(98);
  });

  it("simulates a losing SHORT trade", () => {
    const result = simulateTrade(shortSignal, [
      candle(101, 99, 1),
      candle(103, 100, 2)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(102);
  });

  it("treats simultaneous stop and target hits as a loss", () => {
    const result = simulateTrade(longSignal, [
      candle(103, 97, 1)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
  });

  it("returns null when neither target nor stop is reached", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1)
    ]);

    expect(result).toBeNull();
  });
});