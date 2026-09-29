import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";
import { HistoricalDataLoader } from "../src/data/historical-loader.js";
import { calculateMetrics } from "../src/backtest/metrics.js";
import { runBacktest } from "../src/backtest/backtester.js";
import { validateStrategy } from "../src/strategy/strategy-validator.js";
import { EmaBreakoutStrategy } from "../src/strategy/ema-breakout.js";

const CANDLE_COUNT = 2000;

const provider = new BinanceHistoricalDataProvider();
const loader = new HistoricalDataLoader(provider);
const strategy = new EmaBreakoutStrategy();

const candles = await loader.load({
  symbol: "BTCUSDT",
  timeframe: "15m",
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

const strategyValidation = validateStrategy(strategy);

if (!strategyValidation.valid) {
  throw new Error(
    `Strategy validation failed: ${strategyValidation.errors.join("; ")}`
  );
}

const result = runBacktest(candles, strategy);
const metrics = calculateMetrics(result.trades);

type OverlapStats = {
  maxConcurrentPositions: number;
  overlappingEntries: number;
  overlapEpisodes: number;
  sameDirectionOverlaps: number;
  oppositeDirectionOverlaps: number;
};

type ActiveTrade = {
  entryTimestamp: number;
  exitTimestamp: number;
  direction: "LONG" | "SHORT";
};

function calculateOverlapStats(
  trades: typeof result.trades
): OverlapStats {
  const events = trades.flatMap((trade) => [
    {
      timestamp: trade.entryTimestamp,
      type: "ENTRY" as const,
      trade
    },
    {
      timestamp: trade.exitTimestamp,
      type: "EXIT" as const,
      trade
    }
  ]);

  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }

    // An exit at the same timestamp as another entry
    // does not create simultaneous exposure.
    if (a.type === "EXIT" && b.type === "ENTRY") {
      return -1;
    }

    if (a.type === "ENTRY" && b.type === "EXIT") {
      return 1;
    }

    return 0;
  });

  const activeTrades: ActiveTrade[] = [];

  let maxConcurrentPositions = 0;
  let overlappingEntries = 0;
  let sameDirectionOverlaps = 0;
  let oppositeDirectionOverlaps = 0;

  for (const event of events) {
    if (event.type === "EXIT") {
      const index = activeTrades.findIndex(
        (trade) =>
          trade.entryTimestamp === event.trade.entryTimestamp &&
          trade.exitTimestamp === event.trade.exitTimestamp &&
          trade.direction === event.trade.signal.direction
      );

      if (index !== -1) {
        activeTrades.splice(index, 1);
      }

      continue;
    }

    if (activeTrades.length > 0) {
      overlappingEntries += 1;

      for (const activeTrade of activeTrades) {
        if (
          activeTrade.direction ===
          event.trade.signal.direction
        ) {
          sameDirectionOverlaps += 1;
        } else {
          oppositeDirectionOverlaps += 1;
        }
      }
    }

    activeTrades.push({
      entryTimestamp: event.trade.entryTimestamp,
      exitTimestamp: event.trade.exitTimestamp,
      direction: event.trade.signal.direction
    });

    maxConcurrentPositions = Math.max(
      maxConcurrentPositions,
      activeTrades.length
    );
  }

  let overlapEpisodes = 0;
  const sortedTrades = [...trades].sort(
    (a, b) => a.entryTimestamp - b.entryTimestamp
  );

  let activeUntil = -Infinity;

  for (const trade of sortedTrades) {
    if (trade.entryTimestamp < activeUntil) {
      continue;
    }

    const overlappingTradeExists = sortedTrades.some(
      (other) =>
        other !== trade &&
        other.entryTimestamp < trade.exitTimestamp &&
        trade.entryTimestamp < other.exitTimestamp
    );

    if (overlappingTradeExists) {
      overlapEpisodes += 1;
      activeUntil = Math.max(
        activeUntil,
        ...sortedTrades
          .filter(
            (other) =>
              other.entryTimestamp < trade.exitTimestamp &&
              trade.entryTimestamp < other.exitTimestamp
          )
          .map((other) => other.exitTimestamp)
      );
    }
  }

  return {
    maxConcurrentPositions,
    overlappingEntries,
    overlapEpisodes,
    sameDirectionOverlaps,
    oppositeDirectionOverlaps
  };
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

const overlapStats = calculateOverlapStats(result.trades);

console.log("=== Historical Backtest ===");
console.log(`Candles: ${candles.length}`);
console.log(
  `Range: ${formatTimestamp(candles[0]?.timestamp ?? 0)} → ${formatTimestamp(candles.at(-1)?.timestamp ?? 0)}`
);

console.log("");
console.log("=== Results ===");
console.log(`Trades: ${result.trades.length}`);
console.log(
  `Unresolved signals: ${result.unresolvedSignals.length}`
);

console.log("");
console.log("=== Performance ===");
console.log(`Total R: ${metrics.totalR}`);
console.log(`Average R: ${metrics.averageR}`);
console.log(`Win rate: ${metrics.winRate}`);
console.log(`Profit factor: ${metrics.profitFactor}`);
console.log(
  `Maximum drawdown: ${metrics.maximumDrawdown}R`
);
console.log(
  `Largest winning trade: ${metrics.largestWinningTrade}R`
);
console.log(
  `Largest losing trade: ${metrics.largestLosingTrade}R`
);
console.log(
  `Longest winning streak: ${metrics.longestWinningStreak}`
);
console.log(
  `Longest losing streak: ${metrics.longestLosingStreak}`
);

console.log("");
console.log("=== Concurrency Audit ===");
console.log(
  `Max concurrent resolved positions: ${overlapStats.maxConcurrentPositions}`
);
console.log(
  `Entries made while another position was active: ${overlapStats.overlappingEntries}`
);
console.log(
  `Overlap episodes: ${overlapStats.overlapEpisodes}`
);
console.log(
  `Same-direction overlap pairs: ${overlapStats.sameDirectionOverlaps}`
);
console.log(
  `Opposite-direction overlap pairs: ${overlapStats.oppositeDirectionOverlaps}`
);

console.log("");
console.log("=== Unresolved Signals ===");

for (const unresolved of result.unresolvedSignals) {
  console.log(
    `${formatTimestamp(unresolved.signalTimestamp)} | ` +
      `${unresolved.signal.direction} | ` +
      `entry=${unresolved.signal.entry} | ` +
      `SL=${unresolved.signal.stopLoss} | ` +
      `TP1=${unresolved.signal.takeProfits[0]} | ` +
      `TP2=${unresolved.signal.takeProfits[1]}`
  );
}