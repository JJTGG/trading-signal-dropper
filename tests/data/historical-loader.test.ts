import { describe, expect, it, vi } from "vitest";
import type { Candle } from "../../src/domain/types.js";
import {
  HistoricalDataLoader
} from "../../src/data/historical-loader.js";
import type {
  HistoricalDataProvider,
  HistoricalDataRequest
} from "../../src/data/historical.js";

function createCandle(timestamp: number): Candle {
  return {
    timestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000
  };
}

function createProvider(
  implementation: (
    request: HistoricalDataRequest
  ) => Promise<Candle[]>
): HistoricalDataProvider {
  return {
    getCandles: vi.fn(implementation)
  };
}

describe("HistoricalDataLoader", () => {
  it("loads the requested number of candles across multiple batches", async () => {
    const provider = createProvider(
      async ({ endTime }) => {
        if (endTime === undefined) {
          return Array.from({ length: 1000 }, (_, i) =>
            createCandle(i + 1000)
          );
        }

        return Array.from({ length: 1000 }, (_, i) =>
          createCandle(i)
        );
      }
    );

    const loader = new HistoricalDataLoader(provider);

    const candles = await loader.load({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candleCount: 2000
    });

    expect(candles).toHaveLength(2000);
    expect(candles[0]?.timestamp).toBe(0);
    expect(candles.at(-1)?.timestamp).toBe(1999);

    expect(provider.getCandles).toHaveBeenCalledTimes(2);
  });

  it("requests no more than 1000 candles at a time", async () => {
    const provider = createProvider(
      async () =>
        Array.from({ length: 500 }, (_, i) =>
          createCandle(i)
        )
    );

    const loader = new HistoricalDataLoader(provider);

    await loader.load({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candleCount: 500
    });

    expect(provider.getCandles).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      timeframe: "15m",
      limit: 500,
      endTime: undefined
    });
  });

  it("deduplicates candles by timestamp", async () => {
    let requestCount = 0;

    const provider = createProvider(
      async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return [
            createCandle(3),
            createCandle(4),
            createCandle(5)
          ];
        }

        return [
          createCandle(1),
          createCandle(2),
          createCandle(3)
        ];
      }
    );

    const loader = new HistoricalDataLoader(provider);

    const candles = await loader.load({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candleCount: 5
    });

    expect(candles.map((candle) => candle.timestamp)).toEqual([
      1,
      2,
      3,
      4,
      5
    ]);
  });

  it("continues when a batch is smaller than the requested limit", async () => {
    let requestCount = 0;

    const provider = createProvider(
      async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return [
            createCandle(4),
            createCandle(5)
          ];
        }

        return [
          createCandle(1),
          createCandle(2),
          createCandle(3)
        ];
      }
    );

    const loader = new HistoricalDataLoader(provider);

    const candles = await loader.load({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candleCount: 5
    });

    expect(candles).toHaveLength(5);
    expect(provider.getCandles).toHaveBeenCalledTimes(2);
  });

  it("stops when the provider returns no candles", async () => {
    const provider = createProvider(
      async () => []
    );

    const loader = new HistoricalDataLoader(provider);

    const candles = await loader.load({
      symbol: "BTCUSDT",
      timeframe: "15m",
      candleCount: 100
    });

    expect(candles).toHaveLength(0);
    expect(provider.getCandles).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid candle counts", async () => {
    const provider = createProvider(
      async () => []
    );

    const loader = new HistoricalDataLoader(provider);

    await expect(
      loader.load({
        symbol: "BTCUSDT",
        timeframe: "15m",
        candleCount: 0
      })
    ).rejects.toThrow(
      "Candle count must be a positive integer."
    );
  });
});