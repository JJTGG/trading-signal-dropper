import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";
import { HistoricalDataLoader } from "../src/data/historical-loader.js";
import { validateStrategy } from "../src/backtest/validation.js";
import {
  simulateTrade,
  type SimulatedTrade
} from "../src/backtest/trade-simulator.js";
import { EmaBreakoutStrategy } from "../src/strategy/ema-breakout.js";
import type {
  Candle,
  Direction,
  SignalCandidate
} from "../src/domain/types.js";

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

const validation = validateStrategy(candles, strategy);
const { backtest, metrics } = validation;

type ActiveTrade = {
  entryTimestamp: number;
  exitTimestamp: number;
  direction: Direction;
};

type OverlapStats = {
  maxConcurrentPositions: number;
  overlappingEntries: number;
  overlapEpisodes: number;
  sameDirectionOverlaps: number;
  oppositeDirectionOverlaps: number;
};

type GeneratedSignal = {
  signal: SignalCandidate;
  signalTimestamp: number;
  signalIndex: number;
  resolution: SimulatedTrade | null;
};

type SignalAudit = {
  totalSignals: number;
  longSignals: number;
  shortSignals: number;
  sameDirectionFollowUps: number;
  shortestSameDirectionGapMinutes: number | null;
  largestSameDirectionCluster: number;
  signalsWhilePreviousActive: number;
  maxConcurrentSignals: number;
};

function calculateOverlapStats(
  trades: typeof backtest.trades
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

  const sortedTrades = [...trades].sort(
    (a, b) => a.entryTimestamp - b.entryTimestamp
  );

  let overlapEpisodes = 0;
  let episodeEnd = -Infinity;

  for (const trade of sortedTrades) {
    if (trade.entryTimestamp < episodeEnd) {
      continue;
    }

    const overlappingTrades = sortedTrades.filter(
      (other) =>
        other !== trade &&
        other.entryTimestamp < trade.exitTimestamp &&
        trade.entryTimestamp < other.exitTimestamp
    );

    if (overlappingTrades.length === 0) {
      continue;
    }

    overlapEpisodes += 1;

    episodeEnd = Math.max(
      trade.exitTimestamp,
      ...overlappingTrades.map(
        (other) => other.exitTimestamp
      )
    );
  }

  return {
    maxConcurrentPositions,
    overlappingEntries,
    overlapEpisodes,
    sameDirectionOverlaps,
    oppositeDirectionOverlaps
  };
}

function collectGeneratedSignals(
  historicalCandles: Candle[]
): GeneratedSignal[] {
  const signals: GeneratedSignal[] = [];

  for (let i = 0; i < historicalCandles.length; i += 1) {
    const availableCandles = historicalCandles.slice(0, i + 1);
    const signal = strategy.evaluate(availableCandles);

    if (signal === null) {
      continue;
    }

    const signalTimestamp = historicalCandles[i]?.timestamp;

    if (signalTimestamp === undefined) {
      throw new Error(
        "Generated signal is missing a candle timestamp."
      );
    }

    const futureCandles = historicalCandles.slice(i + 1);
    const resolution = simulateTrade(signal, futureCandles);

    signals.push({
      signal,
      signalTimestamp,
      signalIndex: i,
      resolution
    });
  }

  return signals;
}

function calculateSignalAudit(
  signals: GeneratedSignal[]
): SignalAudit {
  let longSignals = 0;
  let shortSignals = 0;
  let sameDirectionFollowUps = 0;
  let shortestSameDirectionGapMinutes: number | null = null;
  let largestSameDirectionCluster = 0;

  let currentClusterDirection: Direction | null = null;
  let currentClusterSize = 0;

  for (let i = 0; i < signals.length; i += 1) {
    const current = signals[i];

    if (current === undefined) {
      continue;
    }

    if (current.signal.direction === "LONG") {
      longSignals += 1;
    } else {
      shortSignals += 1;
    }

    if (
      currentClusterDirection === current.signal.direction
    ) {
      currentClusterSize += 1;
    } else {
      currentClusterDirection = current.signal.direction;
      currentClusterSize = 1;
    }

    largestSameDirectionCluster = Math.max(
      largestSameDirectionCluster,
      currentClusterSize
    );

    const previous = signals[i - 1];

    if (
      previous !== undefined &&
      previous.signal.direction === current.signal.direction
    ) {
      sameDirectionFollowUps += 1;

      const gapMinutes =
        (current.signalTimestamp -
          previous.signalTimestamp) /
        60_000;

      if (
        shortestSameDirectionGapMinutes === null ||
        gapMinutes < shortestSameDirectionGapMinutes
      ) {
        shortestSameDirectionGapMinutes = gapMinutes;
      }
    }
  }

  const events = signals.flatMap((generated) => {
    if (generated.resolution === null) {
      return [
        {
          timestamp: generated.signalTimestamp,
          type: "ENTRY" as const,
          generated
        }
      ];
    }

    return [
      {
        timestamp: generated.signalTimestamp,
        type: "ENTRY" as const,
        generated
      },
      {
        timestamp: generated.resolution.exitTimestamp,
        type: "EXIT" as const,
        generated
      }
    ];
  });

  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }

    if (a.type === "EXIT" && b.type === "ENTRY") {
      return -1;
    }

    if (a.type === "ENTRY" && b.type === "EXIT") {
      return 1;
    }

    return 0;
  });

  const activeSignals: GeneratedSignal[] = [];

  let signalsWhilePreviousActive = 0;
  let maxConcurrentSignals = 0;

  for (const event of events) {
    if (event.type === "EXIT") {
      const index = activeSignals.indexOf(event.generated);

      if (index !== -1) {
        activeSignals.splice(index, 1);
      }

      continue;
    }

    if (activeSignals.length > 0) {
      signalsWhilePreviousActive += 1;
    }

    activeSignals.push(event.generated);

    maxConcurrentSignals = Math.max(
      maxConcurrentSignals,
      activeSignals.length
    );
  }

  return {
    totalSignals: signals.length,
    longSignals,
    shortSignals,
    sameDirectionFollowUps,
    shortestSameDirectionGapMinutes,
    largestSameDirectionCluster,
    signalsWhilePreviousActive,
    maxConcurrentSignals
  };
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatMinutes(
  minutes: number | null
): string {
  return minutes === null
    ? "N/A"
    : `${minutes} minutes`;
}

const overlapStats = calculateOverlapStats(
  backtest.trades
);

const generatedSignals = collectGeneratedSignals(candles);
const signalAudit = calculateSignalAudit(
  generatedSignals
);

console.log("=== Historical Backtest ===");
console.log(`Candles: ${candles.length}`);
console.log(
  `Range: ${formatTimestamp(candles[0]?.timestamp ?? 0)} → ${formatTimestamp(candles.at(-1)?.timestamp ?? 0)}`
);

console.log("");
console.log("=== Results ===");
console.log(`Trades: ${backtest.trades.length}`);
console.log(
  `Unresolved signals: ${backtest.unresolvedSignals.length}`
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
console.log("=== Signal Generation Audit ===");
console.log(`Total generated signals: ${signalAudit.totalSignals}`);
console.log(`LONG signals: ${signalAudit.longSignals}`);
console.log(`SHORT signals: ${signalAudit.shortSignals}`);
console.log(
  `Same-direction follow-up signals: ${signalAudit.sameDirectionFollowUps}`
);
console.log(
  `Shortest same-direction gap: ${formatMinutes(
    signalAudit.shortestSameDirectionGapMinutes
  )}`
);
console.log(
  `Largest same-direction signal cluster: ${signalAudit.largestSameDirectionCluster}`
);
console.log(
  `Signals generated while another signal was active: ${signalAudit.signalsWhilePreviousActive}`
);
console.log(
  `Maximum simultaneously active signals: ${signalAudit.maxConcurrentSignals}`
);

console.log("");
console.log("=== Unresolved Signals ===");

for (const unresolved of backtest.unresolvedSignals) {
  console.log(
    `${formatTimestamp(unresolved.signalTimestamp)} | ` +
      `${unresolved.signal.direction} | ` +
      `entry=${unresolved.signal.entry} | ` +
      `SL=${unresolved.signal.stopLoss} | ` +
      `TP1=${unresolved.signal.takeProfits[0]} | ` +
      `TP2=${unresolved.signal.takeProfits[1]}`
  );
}