import type { Candle } from "../domain/types.js";
import type { HistoricalDataProvider } from "./historical.js";

export type HistoricalDataRequest = {
  symbol: string;
  timeframe: string;
  candleCount: number;
};

const MAX_CANDLES_PER_REQUEST = 1000;

export class HistoricalDataLoader {
  constructor(
    private readonly provider: HistoricalDataProvider
  ) {}

  async load({
    symbol,
    timeframe,
    candleCount
  }: HistoricalDataRequest): Promise<Candle[]> {
    if (!Number.isInteger(candleCount) || candleCount <= 0) {
      throw new Error("Candle count must be a positive integer.");
    }

    const candles: Candle[] = [];

    let remaining = candleCount;

    while (remaining > 0) {
      const limit = Math.min(
        remaining,
        MAX_CANDLES_PER_REQUEST
      );

      const batch = await this.provider.getCandles(
        symbol,
        timeframe,
        limit
      );

      if (batch.length === 0) {
        break;
      }

      candles.push(...batch);
      remaining -= batch.length;

      if (batch.length < limit) {
        break;
      }
    }

    const uniqueCandles = new Map<number, Candle>();

    for (const candle of candles) {
      uniqueCandles.set(candle.timestamp, candle);
    }

    return [...uniqueCandles.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-candleCount);
  }
}