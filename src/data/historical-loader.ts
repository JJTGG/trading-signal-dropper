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
    let endTime: number | undefined;

    while (candles.length < candleCount) {
      const remaining = candleCount - candles.length;

      const batch = await this.provider.getCandles({
        symbol,
        timeframe,
        limit: Math.min(
          remaining,
          MAX_CANDLES_PER_REQUEST
        ),
        endTime
      });

      if (batch.length === 0) {
        break;
      }

      candles.push(...batch);

      const earliestTimestamp = Math.min(
        ...batch.map((candle) => candle.timestamp)
      );

      if (
        endTime !== undefined &&
        earliestTimestamp >= endTime
      ) {
        throw new Error(
          "Historical data provider did not move backwards."
        );
      }

      endTime = earliestTimestamp - 1;
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