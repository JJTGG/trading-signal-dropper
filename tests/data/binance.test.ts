import { describe, expect, it, vi } from "vitest";
import { BinanceHistoricalDataProvider } from "../../src/data/providers/binance.js";

describe("BinanceHistoricalDataProvider", () => {
  it("converts Binance klines into Candle objects", async () => {
    const response = [
      [
        1000,
        "100.00",
        "105.00",
        "99.00",
        "103.00",
        "42.50",
        1999,
        "0",
        10,
        "0",
        "0",
        "0"
      ]
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200
        })
      )
    );

    const provider = new BinanceHistoricalDataProvider();

    const candles = await provider.getCandles(
      "BTCUSDT",
      "15m",
      1
    );

    expect(candles).toEqual([
      {
        timestamp: 1000,
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 42.5
      }
    ]);
  });

  it("normalizes the symbol to uppercase", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("[]", {
        status: 200
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new BinanceHistoricalDataProvider();

    await provider.getCandles("btcusdt", "15m", 100);

    const request = fetchMock.mock.calls[0]?.[0];

    expect(request).toBeInstanceOf(URL);

    const url = request as URL;

    expect(url.searchParams.get("symbol")).toBe("BTCUSDT");
    expect(url.searchParams.get("interval")).toBe("15m");
    expect(url.searchParams.get("limit")).toBe("100");
  });

  it("rejects failed HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Bad request", {
          status: 400,
          statusText: "Bad Request"
        })
      )
    );

    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles("BTCUSDT", "15m", 100)
    ).rejects.toThrow(
      "Binance historical data request failed: 400 Bad Request"
    );
  });

  it("rejects malformed kline responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([["invalid"]]), {
          status: 200
        })
      )
    );

    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles("BTCUSDT", "15m", 100)
    ).rejects.toThrow("Invalid Binance kline entry.");
  });

  it("rejects invalid request parameters", async () => {
    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles("", "15m", 100)
    ).rejects.toThrow("Symbol is required.");

    await expect(
      provider.getCandles("BTCUSDT", "", 100)
    ).rejects.toThrow("Timeframe is required.");

    await expect(
      provider.getCandles("BTCUSDT", "15m", 0)
    ).rejects.toThrow("Limit must be a positive integer.");
  });
});