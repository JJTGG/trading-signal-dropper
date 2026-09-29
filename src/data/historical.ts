import type { Candle } from "../domain/types.js";

export interface HistoricalDataProvider {
  getCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]>;
}