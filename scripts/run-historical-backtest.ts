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

const resolvedTrades = result.backtest.trades;

const overlappingTrades = [];

for (let i = 0; i < resolvedTrades.length; i += 1) {
  const currentTrade = resolvedTrades[i];

  if (currentTrade === undefined) {
    continue;
  }

  for (
    let j = i + 1;
    j < resolvedTrades.length;
    j += 1
  ) {
    const otherTrade = resolvedTrades[j];

    if (otherTrade === undefined) {
      continue;
    }

    const currentStartsBeforeOtherEnds =
      currentTrade.entryTimestamp <
      otherTrade.exitTimestamp;

    const otherStartsBeforeCurrentEnds =
      otherTrade.entryTimestamp <
      currentTrade.exitTimestamp;

    if (
      currentStartsBeforeOtherEnds &&
      otherStartsBeforeCurrentEnds
    ) {
      overlappingTrades.push({
        first: currentTrade,
        second: otherTrade
      });
    }
  }
}

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
  `Trades: ${resolvedTrades.length}`
);
console.log(
  `Unresolved signals: ${result.backtest.unresolvedSignals.length}`
);

console.log("");
console.log("Overlap audit");
console.log("-------------");
console.log(
  `Overlapping resolved trade pairs: ${overlappingTrades.length}`
);

if (overlappingTrades.length > 0) {
  for (
    const overlap of overlappingTrades
  ) {
    console.log("");

    console.log(
      `First trade: ${new Date(
        overlap.first.entryTimestamp
      ).toISOString()} → ${new Date(
        overlap.first.exitTimestamp
      ).toISOString()}`
    );

    console.log(
      `  Direction: ${overlap.first.signal.direction}`
    );

    console.log(
      `  R: ${overlap.first.rMultiple}`
    );

    console.log(
      `Second trade: ${new Date(
        overlap.second.entryTimestamp
      ).toISOString()} → ${new Date(
        overlap.second.exitTimestamp
      ).toISOString()}`
    );

    console.log(
      `  Direction: ${overlap.second.signal.direction}`
    );

    console.log(
      `  R: ${overlap.second.rMultiple}`
    );
  }
}

console.log("");
console.log("Metrics");
console.log("-------");
console.log(result.metrics);