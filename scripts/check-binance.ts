import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";

const provider = new BinanceHistoricalDataProvider();

const candles = await provider.getCandles(
  "BTCUSDT",
  "15m",
  10
);

console.log(`Received ${candles.length} candles.`);
console.log("First candle:", candles[0]);
console.log("Last candle:", candles.at(-1));