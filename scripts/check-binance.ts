import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";

const provider = new BinanceHistoricalDataProvider();

const latest = await provider.getCandles({
  symbol: "BTCUSDT",
  timeframe: "15m",
  limit: 10
});

const earlier = await provider.getCandles({
  symbol: "BTCUSDT",
  timeframe: "15m",
  limit: 10,
  endTime: (latest[0]?.timestamp ?? Date.now()) - 1
});

console.log(`Latest batch: ${latest.length} candles.`);
console.log(`Earlier batch: ${earlier.length} candles.`);
console.log("Latest first:", latest[0]);
console.log("Latest last:", latest.at(-1));
console.log("Earlier first:", earlier[0]);
console.log("Earlier last:", earlier.at(-1));