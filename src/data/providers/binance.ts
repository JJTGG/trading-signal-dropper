import type { Candle } from "../../domain/types.js";
import type { HistoricalDataProvider } from "../historical.js";

const BINANCE_BASE_URL = "https://data-api.binance.vision";

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

export class BinanceHistoricalDataProvider
  implements HistoricalDataProvider
{
  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]> {
    if (!symbol.trim()) {
      throw new Error("Symbol is required.");
    }

    if (!timeframe.trim()) {
      throw new Error("Timeframe is required.");
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Limit must be a positive integer.");
    }

    const url = new URL("/api/v3/klines", BINANCE_BASE_URL);

    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Binance historical data request failed: ${response.status} ${response.statusText}`
      );
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      throw new Error("Invalid Binance kline response.");
    }

    return payload.map((entry) => this.toCandle(entry));
  }

  private toCandle(entry: unknown): Candle {
    if (!Array.isArray(entry) || entry.length < 6) {
      throw new Error("Invalid Binance kline entry.");
    }

    const [
      timestamp,
      open,
      high,
      low,
      close,
      volume
    ] = entry as Partial<BinanceKline>;

    if (
      typeof timestamp !== "number" ||
      typeof open !== "string" ||
      typeof high !== "string" ||
      typeof low !== "string" ||
      typeof close !== "string" ||
      typeof volume !== "string"
    ) {
      throw new Error("Invalid Binance kline values.");
    }

    const candle = {
      timestamp,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume)
    };

    if (
      !Number.isFinite(candle.timestamp) ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close) ||
      !Number.isFinite(candle.volume)
    ) {
      throw new Error("Binance kline contains non-finite values.");
    }

    return candle;
  }
}