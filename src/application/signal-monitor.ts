import type { HistoricalDataProvider } from "../data/historical.js";
import {
  generateSignal,
  type GeneratedSignal
} from "./signal.js";

export type SignalMonitorConfig = {
  symbol: string;
  timeframe?: string;
};

export type SignalMonitorResult = {
  newCandle: boolean;
  candleTimestamp: number;
  signal: GeneratedSignal | null;
};

export class SignalMonitor {
  private readonly symbol: string;
  private readonly timeframe: string;

  private lastProcessedCandleTimestamp:
    number | undefined;

  private lastEvaluatedCandleTimestamp:
    number | undefined;

  constructor(
    private readonly provider: HistoricalDataProvider,
    {
      symbol,
      timeframe = "15m"
    }: SignalMonitorConfig
  ) {
    if (!symbol.trim()) {
      throw new Error("Symbol is required.");
    }

    if (!timeframe.trim()) {
      throw new Error("Timeframe is required.");
    }

    this.symbol = symbol;
    this.timeframe = timeframe;
  }

  async check(): Promise<SignalMonitorResult> {
    const latestCandles =
      await this.provider.getCandles({
        symbol: this.symbol,
        timeframe: this.timeframe,
        limit: 1
      });

    const currentCandle = latestCandles.at(-1);

    if (currentCandle === undefined) {
      throw new Error(
        "Historical data provider returned no current candle."
      );
    }

    const candleTimestamp = currentCandle.timestamp;

    if (
      this.lastProcessedCandleTimestamp ===
      candleTimestamp
    ) {
      return {
        newCandle: false,
        candleTimestamp,
        signal: null
      };
    }

    const closedCandleEndTime =
      candleTimestamp - 1;

    if (closedCandleEndTime < 0) {
      throw new Error(
        "Current candle timestamp is invalid."
      );
    }

    const signal = await generateSignal(
      this.provider,
      {
        symbol: this.symbol,
        timeframe: this.timeframe,
        endTime: closedCandleEndTime
      }
    );

    this.lastEvaluatedCandleTimestamp =
      candleTimestamp;

    return {
      newCandle: true,
      candleTimestamp,
      signal
    };
  }

  markProcessed(candleTimestamp: number): void {
    if (
      this.lastEvaluatedCandleTimestamp !==
      candleTimestamp
    ) {
      throw new Error(
        "Cannot mark an unevaluated candle as processed."
      );
    }

    this.lastProcessedCandleTimestamp =
      candleTimestamp;
  }
}