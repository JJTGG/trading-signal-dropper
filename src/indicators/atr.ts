import type { Candle } from "../domain/types.js";

function trueRange(
  current: Candle,
  previousClose?: number
): number {
  if (previousClose === undefined) {
    return current.high - current.low;
  }

  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose)
  );
}

export function atr(candles: Candle[], period: number): number[] {
  if (period <= 0) {
    throw new Error("ATR period must be greater than zero.");
  }

  if (candles.length < period) {
    return [];
  }

  const ranges = candles.map((candle, index) =>
    trueRange(candle, candles[index - 1]?.close)
  );

  if (ranges.length < period) {
    return [];
  }

  const result: number[] = [];

  let previousAtr =
    ranges
      .slice(0, period)
      .reduce((sum, range) => sum + range, 0) / period;

  result.push(previousAtr);

  for (let i = period; i < ranges.length; i += 1) {
    const currentRange = ranges[i];

    if (currentRange === undefined) {
      throw new Error("Unexpected missing true range.");
    }

    previousAtr =
      ((previousAtr * (period - 1)) + currentRange) / period;

    result.push(previousAtr);
  }

  return result;
}