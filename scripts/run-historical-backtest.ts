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

    const signalIndex = candles.findIndex(
      (candle) =>
        candle.timestamp === signalTimestamp
    );

    const futureCandles =
      signalIndex === -1
        ? []
        : candles.slice(signalIndex + 1);

    const finalFutureCandle =
      futureCandles.at(-1);

    const highestHigh =
      futureCandles.length > 0
        ? Math.max(
            ...futureCandles.map(
              (candle) => candle.high
            )
          )
        : null;

    const lowestLow =
      futureCandles.length > 0
        ? Math.min(
            ...futureCandles.map(
              (candle) => candle.low
            )
          )
        : null;

    const tp2Progress =
      highestHigh === null
        ? null
        : (
            (highestHigh - signal.entry) /
            (signal.takeProfits[1] - signal.entry)
          ) * 100;

    const stopDistance =
      lowestLow === null
        ? null
        : (
            (signal.entry - lowestLow) /
            (signal.entry - signal.stopLoss)
          ) * 100;

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
    console.log(
      `Future candles: ${futureCandles.length}`
    );

    if (finalFutureCandle !== undefined) {
      console.log(
        `Final future candle: ${new Date(
          finalFutureCandle.timestamp
        ).toISOString()}`
      );
      console.log(
        `Final OHLC: ${finalFutureCandle.open} / ${finalFutureCandle.high} / ${finalFutureCandle.low} / ${finalFutureCandle.close}`
      );
    }

    console.log(
      `Highest high after signal: ${highestHigh ?? "N/A"}`
    );
    console.log(
      `Lowest low after signal: ${lowestLow ?? "N/A"}`
    );

    console.log(
      `TP2 progress: ${
        tp2Progress === null
          ? "N/A"
          : `${tp2Progress.toFixed(2)}%`
      }`
    );

    console.log(
      `Stop distance reached: ${
        stopDistance === null
          ? "N/A"
          : `${stopDistance.toFixed(2)}%`
      }`
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