import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";
import { HistoricalDataLoader } from "../src/data/historical-loader.js";
import { validateStrategy } from "../src/backtest/validation.js";
import { EmaBreakoutStrategy } from "../src/strategy/ema-breakout.js";

const SYMBOL = "BTCUSDT";
const TIMEFRAME = "15m";
const CANDLE_COUNT = 2000;

const provider = new BinanceHistoricalDataProvider();
const loader = new HistoricalDataLoader(provider);
const strategy = new EmaBreakoutStrategy();

console.log(
  `Loading ${CANDLE_COUNT} ${SYMBOL} ${TIMEFRAME} candles...`
);

const candles = await loader.load({
  symbol: SYMBOL,
  timeframe: TIMEFRAME,
  candleCount: CANDLE_COUNT
});

if (candles.length !== CANDLE_COUNT) {
  throw new Error(
    `Expected ${CANDLE_COUNT} candles, received ${candles.length}.`
  );
}

for (let i = 1; i < candles.length; i += 1) {
  const previous = candles[i - 1];
  const current = candles[i];

  if (
    previous === undefined ||
    current === undefined ||
    current.timestamp <= previous.timestamp
  ) {
    throw new Error(
      "Historical candles are not strictly chronological."
    );
  }
}

const firstCandle = candles[0];
const lastCandle = candles.at(-1);

if (
  firstCandle === undefined ||
  lastCandle === undefined
) {
  throw new Error("Historical dataset is empty.");
}

const result = validateStrategy(
  candles,
  strategy
);

console.log("");
console.log("Historical dataset");
console.log("------------------");
console.log(`Symbol: ${SYMBOL}`);
console.log(`Timeframe: ${TIMEFRAME}`);
console.log(`Candles: ${candles.length}`);
console.log(
  `First timestamp: ${new Date(
    firstCandle.timestamp
  ).toISOString()}`
);
console.log(
  `Last timestamp: ${new Date(
    lastCandle.timestamp
  ).toISOString()}`
);

console.log("");
console.log("Backtest");
console.log("--------");
console.log(
  `Trades: ${result.backtest.trades.length}`
);
console.log(
  `Unresolved signals: ${result.backtest.unresolvedSignals.length}`
);

if (result.backtest.unresolvedSignals.length > 0) {
  console.log("");
  console.log("Unresolved signals");
  console.log("------------------");

  for (
    const unresolved of result.backtest.unresolvedSignals
  ) {
    const {
      signal,
      signalTimestamp
    } = unresolved;

    console.log("");
    console.log(
      `Timestamp: ${new Date(
        signalTimestamp
      ).toISOString()}`
    );
    console.log(`Direction: ${signal.direction}`);
    console.log(`Entry: ${signal.entry}`);
    console.log(`Stop loss: ${signal.stopLoss}`);
    console.log(
      `Take profits: ${signal.takeProfits.join(", ")}`
    );
    console.log(`Strategy: ${signal.strategy}`);
    console.log(`Timeframe: ${signal.timeframe}`);
    console.log(`Reason: ${signal.reason}`);
  }
}

console.log("");
console.log("Metrics");
console.log("-------");
console.log(result.metrics);