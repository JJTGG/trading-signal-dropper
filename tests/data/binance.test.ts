import { describe, expect, it, vi } from "vitest";
import { BinanceHistoricalDataProvider } from "../../src/data/providers/binance.js";

describe("BinanceHistoricalDataProvider", () => {
  it("converts Binance klines to Candle", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            [
              1000,
              "100.5",
              "101.5",
              "99.5",
              "101",
              "12.5",
              2000,
              "1260",
              13,
              "50",
              "5000",
              "0"
            ]
          ]),
          { status: 200 }
        )
      );

    const provider = new BinanceHistoricalDataProvider();

    const candles = await provider.getCandles({
      symbol: "BTCUSDT",
      timeframe: "15m",
      limit: 1
    });

    expect(candles).toEqual([
      {
        timestamp: 1000,
        open: 100.5,
        high: 101.5,
        low: 99.5,
        close: 101,
        volume: 12.5
      }
    ]);

    fetchMock.mockRestore();
  });

  it("normalizes symbol to uppercase", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("[]", { status: 200 })
      );

    const provider = new BinanceHistoricalDataProvider();

    await provider.getCandles({
      symbol: "btcusdt",
      timeframe: "15m",
      limit: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [request] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request));

    expect(url.searchParams.get("symbol")).toBe("BTCUSDT");

    fetchMock.mockRestore();
  });

  it("passes endTime when provided", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("[]", { status: 200 })
      );

    const provider = new BinanceHistoricalDataProvider();

    await provider.getCandles({
      symbol: "BTCUSDT",
      timeframe: "15m",
      limit: 1000,
      endTime: 123456789
    });

    const [request] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request));

    expect(url.searchParams.get("endTime")).toBe(
      "123456789"
    );

    fetchMock.mockRestore();
  });

  it("rejects failed HTTP responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("Bad request", {
          status: 400,
          statusText: "Bad Request"
        })
      );

    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles({
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 10
      })
    ).rejects.toThrow(
      "Binance historical data request failed: 400 Bad Request"
    );

    fetchMock.mockRestore();
  });

  it("rejects malformed kline responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(["invalid"]), {
          status: 200
        })
      );

    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles({
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 10
      })
    ).rejects.toThrow("Invalid Binance kline entry.");

    fetchMock.mockRestore();
  });

  it("rejects invalid request parameters", async () => {
    const provider = new BinanceHistoricalDataProvider();

    await expect(
      provider.getCandles({
        symbol: "",
        timeframe: "15m",
        limit: 10
      })
    ).rejects.toThrow("Symbol is required.");

    await expect(
      provider.getCandles({
        symbol: "BTCUSDT",
        timeframe: "",
        limit: 10
      })
    ).rejects.toThrow("Timeframe is required.");

    await expect(
      provider.getCandles({
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 0
      })
    ).rejects.toThrow("Limit must be a positive integer.");

    await expect(
      provider.getCandles({
        symbol: "BTCUSDT",
        timeframe: "15m",
        limit: 10,
        endTime: -1
      })
    ).rejects.toThrow(
      "End time must be a valid timestamp."
    );
  });
});