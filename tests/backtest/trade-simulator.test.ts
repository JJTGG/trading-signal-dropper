import { describe, expect, it } from "vitest";
import type {
  Candle,
  SignalCandidate
} from "../../src/domain/types.js";
import { simulateTrade } from "../../src/backtest/trade-simulator.js";

const longSignal: SignalCandidate = {
  direction: "LONG",
  entry: 100,
  stopLoss: 98,
  takeProfits: [102, 104],
  strategy: "Test",
  timeframe: "15m",
  reason: "Test signal"
};

const shortSignal: SignalCandidate = {
  direction: "SHORT",
  entry: 100,
  stopLoss: 102,
  takeProfits: [98, 96],
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
  it("simulates a LONG trade reaching TP1 and TP2", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1),
      candle(103, 100, 2),
      candle(105, 102, 3)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1.5);
    expect(result?.exitPrice).toBe(104);
    expect(result?.entryTimestamp).toBe(1);
    expect(result?.exitTimestamp).toBe(3);
  });

  it("simulates a SHORT trade reaching TP1 and TP2", () => {
    const result = simulateTrade(shortSignal, [
      candle(101, 99, 1),
      candle(100, 97, 2),
      candle(98, 95, 3)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1.5);
    expect(result?.exitPrice).toBe(96);
    expect(result?.entryTimestamp).toBe(1);
    expect(result?.exitTimestamp).toBe(3);
  });

  it("returns breakeven when LONG reaches TP1 then the remaining position hits the stop", () => {
    const result = simulateTrade(longSignal, [
      candle(103, 100, 1),
      candle(101, 97, 2)
    ]);

    expect(result?.outcome).toBe("BREAKEVEN");
    expect(result?.rMultiple).toBe(0);
    expect(result?.exitPrice).toBe(98);
    expect(result?.exitTimestamp).toBe(2);
  });

  it("returns breakeven when SHORT reaches TP1 then the remaining position hits the stop", () => {
    const result = simulateTrade(shortSignal, [
      candle(100, 97, 1),
      candle(103, 99, 2)
    ]);

    expect(result?.outcome).toBe("BREAKEVEN");
    expect(result?.rMultiple).toBe(0);
    expect(result?.exitPrice).toBe(102);
    expect(result?.exitTimestamp).toBe(2);
  });

  it("simulates a LONG loss when the stop is hit before TP1", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1),
      candle(100, 97, 2)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(98);
    expect(result?.exitTimestamp).toBe(2);
  });

  it("simulates a SHORT loss when the stop is hit before TP1", () => {
    const result = simulateTrade(shortSignal, [
      candle(101, 99, 1),
      candle(103, 100, 2)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(102);
    expect(result?.exitTimestamp).toBe(2);
  });

  it("treats simultaneous LONG stop and TP1 touches as a loss", () => {
    const result = simulateTrade(longSignal, [
      candle(103, 97, 1)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(98);
  });

  it("treats simultaneous SHORT stop and TP1 touches as a loss", () => {
    const result = simulateTrade(shortSignal, [
      candle(103, 97, 1)
    ]);

    expect(result?.outcome).toBe("LOSS");
    expect(result?.rMultiple).toBe(-1);
    expect(result?.exitPrice).toBe(102);
  });

  it("allows TP1 and TP2 to be reached in the same LONG candle", () => {
    const result = simulateTrade(longSignal, [
      candle(105, 99, 1)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1.5);
    expect(result?.exitPrice).toBe(104);
  });

  it("allows TP1 and TP2 to be reached in the same SHORT candle", () => {
    const result = simulateTrade(shortSignal, [
      candle(101, 95, 1)
    ]);

    expect(result?.outcome).toBe("WIN");
    expect(result?.rMultiple).toBe(1.5);
    expect(result?.exitPrice).toBe(96);
  });

  it("treats simultaneous LONG stop and TP2 touches after TP1 as breakeven", () => {
    const result = simulateTrade(longSignal, [
      candle(103, 100, 1),
      candle(105, 97, 2)
    ]);

    expect(result?.outcome).toBe("BREAKEVEN");
    expect(result?.rMultiple).toBe(0);
    expect(result?.exitPrice).toBe(98);
  });

  it("treats simultaneous SHORT stop and TP2 touches after TP1 as breakeven", () => {
    const result = simulateTrade(shortSignal, [
      candle(100, 97, 1),
      candle(103, 95, 2)
    ]);

    expect(result?.outcome).toBe("BREAKEVEN");
    expect(result?.rMultiple).toBe(0);
    expect(result?.exitPrice).toBe(102);
  });

  it("returns null when neither target nor stop is reached", () => {
    const result = simulateTrade(longSignal, [
      candle(101, 99, 1)
    ]);

    expect(result).toBeNull();
  });

  it("returns null when TP1 is reached but the remaining position is unresolved", () => {
    const result = simulateTrade(longSignal, [
      candle(103, 100, 1),
      candle(103, 100, 2)
    ]);

    expect(result).toBeNull();
  });

  it("returns null when there are no candles", () => {
    const result = simulateTrade(
      longSignal,
      []
    );

    expect(result).toBeNull();
  });

  it("returns null when fewer than two take-profit levels are provided", () => {
    const signal: SignalCandidate = {
      ...longSignal,
      takeProfits: [102]
    };

    const result = simulateTrade(signal, [
      candle(103, 100, 1)
    ]);

    expect(result).toBeNull();
  });

  it("returns null when entry and stop have zero risk", () => {
    const signal: SignalCandidate = {
      ...longSignal,
      stopLoss: 100
    };

    const result = simulateTrade(signal, [
      candle(103, 100, 1)
    ]);

    expect(result).toBeNull();
  });
});