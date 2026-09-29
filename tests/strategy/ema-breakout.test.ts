import { describe, expect, it } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import { EmaBreakoutStrategy } from "../../src/strategy/ema-breakout.js";

function createCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: index + 1,
    open: close,
    high: close + 1,
    low: close - 1,
    close
  }));
}

const config = {
  timeframe: "15m",
  fastEmaPeriod: 3,
  slowEmaPeriod: 5,
  breakoutLookback: 3,
  atrPeriod: 3,
  stopAtrMultiplier: 1,
  takeProfitRMultiples: [1, 2]
};

describe("EmaBreakoutStrategy", () => {
  it("generates a LONG signal after an upside breakout", () => {
    const strategy = new EmaBreakoutStrategy(config);

    const candles = createCandles([
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
    ]);

    const signal = strategy.evaluate(candles);

    expect(signal).not.toBeNull();
    expect(signal?.direction).toBe("LONG");
    expect(signal?.entry).toBe(111);
    expect(signal?.stopLoss).toBe(109);
    expect(signal?.takeProfits).toEqual([113, 115]);
  });

  it("generates a SHORT signal after a downside breakout", () => {
    const strategy = new EmaBreakoutStrategy(config);

    const candles = createCandles([
      111,
      108,
      107,
      106,
      105,
      104,
      103,
      102,
      101,
      98
    ]);

    const signal = strategy.evaluate(candles);

    expect(signal).not.toBeNull();
    expect(signal?.direction).toBe("SHORT");
    expect(signal?.entry).toBe(98);
    expect(signal?.stopLoss).toBe(100);
    expect(signal?.takeProfits).toEqual([96, 94]);
  });

  it("returns null when there is no breakout", () => {
    const strategy = new EmaBreakoutStrategy(config);

    const candles = createCandles([
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
    ]);

    expect(strategy.evaluate(candles)).toBeNull();
  });

  it("returns null when there is insufficient data", () => {
    const strategy = new EmaBreakoutStrategy(config);

    const candles = createCandles([100, 101, 102]);

    expect(strategy.evaluate(candles)).toBeNull();
  });
});