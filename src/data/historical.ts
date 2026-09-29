import type { Candle } from "../domain/types.js";

export type HistoricalDataRequest = {
  symbol: string;
  timeframe: string;
  limit: number;
  endTime?: number;
};

export interface HistoricalDataProvider {
  getCandles(request: HistoricalDataRequest): Promise<Candle[]>;
}