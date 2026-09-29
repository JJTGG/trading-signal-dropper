import { describe, expect, it } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import { atr } from "../../src/indicators/atr.js";

const candles: Candle[] = [
  {
    timestamp: 1,
    open: 100,
    high: 105,
    low: 95,
    close: 102
  },
  {
    timestamp: 2,
    open: 102,
    high: 108,
    low: 100,
    close: 106
  },
  {
    timestamp: 3,
    open: 106,
    high: 110,
    low: 103,
    close: 104
  },
  {
    timestamp: 4,
    open: 104,
    high: 109,
    low: 101,
    close: 108
  }
];

describe("atr", () => {
  it("calculates ATR using Wilder smoothing", () => {
    const result = atr(candles, 3);

    expect(result).toHaveLength(2);

    expect(result[0]).toBeCloseTo(8.333333, 5);
    expect(result[1]).toBeCloseTo(8.222222, 5);
  });

  it("returns an empty array when there is insufficient data", () => {
    expect(atr(candles.slice(0, 2), 3)).toEqual([]);
  });

  it("rejects an invalid period", () => {
    expect(() => atr(candles, 0)).toThrow(
      "ATR period must be greater than zero."
    );
  });
});