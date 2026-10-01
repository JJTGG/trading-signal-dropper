import type { HistoricalDataProvider } from "../data/historical.js";
import type { SignalCandidate } from "../domain/types.js";
import { EmaBreakoutStrategy } from "../strategy/ema-breakout.js";

const DEFAULT_SIGNAL_CANDLE_COUNT = 100;

export type SignalRequest = {
  symbol: string;
  timeframe?: string;
  endTime?: number;
};

export type GeneratedSignal = {
  symbol: string;
  signal: SignalCandidate;
};

export async function generateSignal(
  provider: HistoricalDataProvider,
  {
    symbol,
    timeframe = "15m",
    endTime
  }: SignalRequest
): Promise<GeneratedSignal | null> {
  if (!symbol.trim()) {
    throw new Error("Symbol is required.");
  }

  if (!timeframe.trim()) {
    throw new Error("Timeframe is required.");
  }

  if (
    endTime !== undefined &&
    (!Number.isFinite(endTime) || endTime < 0)
  ) {
    throw new Error("End time must be a valid timestamp.");
  }

  const request =
    endTime === undefined
      ? {
          symbol,
          timeframe,
          limit: DEFAULT_SIGNAL_CANDLE_COUNT
        }
      : {
          symbol,
          timeframe,
          limit: DEFAULT_SIGNAL_CANDLE_COUNT,
          endTime
        };

  const candles = await provider.getCandles(request);

  const strategy = new EmaBreakoutStrategy({
    timeframe
  });

  const signal = strategy.evaluate(candles);

  if (signal === null) {
    return null;
  }

  return {
    symbol: symbol.toUpperCase(),
    signal
  };
}