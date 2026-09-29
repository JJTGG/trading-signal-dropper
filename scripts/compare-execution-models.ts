import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";
import { HistoricalDataLoader } from "../src/data/historical-loader.js";
import {
  simulateTrade,
  type SimulatedTrade
} from "../src/backtest/trade-simulator.js";
import {
  calculateMetrics,
  type PerformanceMetrics
} from "../src/backtest/metrics.js";
import type {
  Candle,
  Direction,
  SignalCandidate
} from "../src/domain/types.js";
import { EmaBreakoutStrategy } from "../src/strategy/ema-breakout.js";

const CANDLE_COUNT = 2000;

type GeneratedSignal = {
  signal: SignalCandidate;
  signalTimestamp: number;
  candleIndex: number;
};

type ExecutionAudit = {
  trades: SimulatedTrade[];
  unresolvedSignals: GeneratedSignal[];
  skippedSignals: GeneratedSignal[];
  metrics: PerformanceMetrics;
};

type ClassifiedTrade = SimulatedTrade & {
  entryType: "INITIAL" | "STACKED";
};

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

function generateSignals(
  historicalCandles: Candle[]
): GeneratedSignal[] {
  const signals: GeneratedSignal[] = [];

  for (let i = 0; i < historicalCandles.length; i += 1) {
    const signal = strategy.evaluate(
      historicalCandles.slice(0, i + 1)
    );

    if (signal === null) {
      continue;
    }

    const signalTimestamp =
      historicalCandles[i]?.timestamp;

    if (signalTimestamp === undefined) {
      throw new Error(
        "Generated signal candle is missing a timestamp."
      );
    }

    signals.push({
      signal,
      signalTimestamp,
      candleIndex: i
    });
  }

  return signals;
}

function simulateGeneratedSignal(
  historicalCandles: Candle[],
  generated: GeneratedSignal
): SimulatedTrade | null {
  const futureCandles = historicalCandles.slice(
    generated.candleIndex + 1
  );

  const trade = simulateTrade(
    generated.signal,
    futureCandles
  );

  if (trade === null) {
    return null;
  }

  return {
    ...trade,
    entryTimestamp: generated.signalTimestamp
  };
}

function runIndependentModel(
  historicalCandles: Candle[],
  signals: GeneratedSignal[]
): ExecutionAudit {
  const trades: SimulatedTrade[] = [];
  const unresolvedSignals: GeneratedSignal[] = [];

  for (const generated of signals) {
    const trade = simulateGeneratedSignal(
      historicalCandles,
      generated
    );

    if (trade === null) {
      unresolvedSignals.push(generated);
      continue;
    }

    trades.push(trade);
  }

  return {
    trades,
    unresolvedSignals,
    skippedSignals: [],
    metrics: calculateMetrics(trades)
  };
}

function runSinglePositionModel(
  historicalCandles: Candle[],
  signals: GeneratedSignal[]
): ExecutionAudit {
  const trades: SimulatedTrade[] = [];
  const unresolvedSignals: GeneratedSignal[] = [];
  const skippedSignals: GeneratedSignal[] = [];

  let activeExitTimestamp: number | null = null;

  for (const generated of signals) {
    if (
      activeExitTimestamp !== null &&
      generated.signalTimestamp < activeExitTimestamp
    ) {
      skippedSignals.push(generated);
      continue;
    }

    const trade = simulateGeneratedSignal(
      historicalCandles,
      generated
    );

    if (trade === null) {
      unresolvedSignals.push(generated);

      activeExitTimestamp =
        historicalCandles.at(-1)?.timestamp ?? null;

      continue;
    }

    trades.push(trade);
    activeExitTimestamp = trade.exitTimestamp;
  }

  return {
    trades,
    unresolvedSignals,
    skippedSignals,
    metrics: calculateMetrics(trades)
  };
}

function runPerDirectionModel(
  historicalCandles: Candle[],
  signals: GeneratedSignal[]
): ExecutionAudit {
  const trades: SimulatedTrade[] = [];
  const unresolvedSignals: GeneratedSignal[] = [];
  const skippedSignals: GeneratedSignal[] = [];

  const activeExitTimestamps = new Map<
    Direction,
    number
  >();

  for (const generated of signals) {
    const direction = generated.signal.direction;
    const activeExitTimestamp =
      activeExitTimestamps.get(direction);

    if (
      activeExitTimestamp !== undefined &&
      generated.signalTimestamp < activeExitTimestamp
    ) {
      skippedSignals.push(generated);
      continue;
    }

    const trade = simulateGeneratedSignal(
      historicalCandles,
      generated
    );

    if (trade === null) {
      unresolvedSignals.push(generated);

      const finalTimestamp =
        historicalCandles.at(-1)?.timestamp;

      if (finalTimestamp !== undefined) {
        activeExitTimestamps.set(
          direction,
          finalTimestamp
        );
      }

      continue;
    }

    trades.push(trade);

    activeExitTimestamps.set(
      direction,
      trade.exitTimestamp
    );
  }

  return {
    trades,
    unresolvedSignals,
    skippedSignals,
    metrics: calculateMetrics(trades)
  };
}

function classifySameDirectionTrades(
  trades: SimulatedTrade[]
): ClassifiedTrade[] {
  const sortedTrades = [...trades].sort(
    (a, b) => a.entryTimestamp - b.entryTimestamp
  );

  const activeByDirection = new Map<
    Direction,
    SimulatedTrade[]
  >();

  return sortedTrades.map((trade) => {
    const activeTrades =
      activeByDirection.get(trade.signal.direction) ?? [];

    const hasActiveSameDirectionTrade =
      activeTrades.some(
        (activeTrade) =>
          activeTrade.entryTimestamp < trade.entryTimestamp &&
          trade.entryTimestamp < activeTrade.exitTimestamp
      );

    const classifiedTrade: ClassifiedTrade = {
      ...trade,
      entryType: hasActiveSameDirectionTrade
        ? "STACKED"
        : "INITIAL"
    };

    activeTrades.push(trade);

    activeByDirection.set(
      trade.signal.direction,
      activeTrades.filter(
        (activeTrade) =>
          activeTrade.exitTimestamp > trade.entryTimestamp
      )
    );

    return classifiedTrade;
  });
}

function printMetrics(
  name: string,
  trades: SimulatedTrade[]
): void {
  const metrics = calculateMetrics(trades);

  console.log(`=== ${name} ===`);
  console.log(`Trades: ${trades.length}`);
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
}

function printDifference(
  baseline: ExecutionAudit,
  comparison: ExecutionAudit,
  name: string
): void {
  console.log(`=== ${name} vs Independent ===`);
  console.log(
    `Trade reduction: ${
      baseline.trades.length - comparison.trades.length
    }`
  );
  console.log(
    `Signals skipped: ${comparison.skippedSignals.length}`
  );
  console.log(
    `Total R difference: ${
      comparison.metrics.totalR - baseline.metrics.totalR
    }`
  );
  console.log(
    `Average R difference: ${
      comparison.metrics.averageR -
      baseline.metrics.averageR
    }`
  );
  console.log(
    `Maximum drawdown difference: ${
      comparison.metrics.maximumDrawdown -
      baseline.metrics.maximumDrawdown
    }R`
  );
}

const signals = generateSignals(candles);

const independent = runIndependentModel(
  candles,
  signals
);

const singlePosition = runSinglePositionModel(
  candles,
  signals
);

const perDirection = runPerDirectionModel(
  candles,
  signals
);

const classifiedTrades =
  classifySameDirectionTrades(independent.trades);

const initialTrades = classifiedTrades.filter(
  (trade) => trade.entryType === "INITIAL"
);

const stackedTrades = classifiedTrades.filter(
  (trade) => trade.entryType === "STACKED"
);

const longSignals = signals.filter(
  ({ signal }) => signal.direction === "LONG"
).length;

const shortSignals = signals.filter(
  ({ signal }) => signal.direction === "SHORT"
).length;

const stackedR = stackedTrades.reduce(
  (total, trade) => total + trade.rMultiple,
  0
);

const initialR = initialTrades.reduce(
  (total, trade) => total + trade.rMultiple,
  0
);

console.log("=== Execution Model Audit ===");
console.log(`Candles: ${candles.length}`);
console.log(
  `Range: ${new Date(
    candles[0]?.timestamp ?? 0
  ).toISOString()} → ${new Date(
    candles.at(-1)?.timestamp ?? 0
  ).toISOString()}`
);
console.log(`Generated signals: ${signals.length}`);
console.log(`LONG signals: ${longSignals}`);
console.log(`SHORT signals: ${shortSignals}`);

console.log("");

printMetrics(
  "Independent Execution",
  independent.trades
);

console.log(
  `Unresolved signals: ${independent.unresolvedSignals.length}`
);

console.log("");

printMetrics(
  "Single-Position Execution",
  singlePosition.trades
);

console.log(
  `Unresolved signals: ${singlePosition.unresolvedSignals.length}`
);
console.log(
  `Skipped signals: ${singlePosition.skippedSignals.length}`
);

console.log("");

printMetrics(
  "One-Position-Per-Direction Execution",
  perDirection.trades
);

console.log(
  `Unresolved signals: ${perDirection.unresolvedSignals.length}`
);
console.log(
  `Skipped signals: ${perDirection.skippedSignals.length}`
);

console.log("");

printDifference(
  independent,
  singlePosition,
  "Single-Position Model"
);

console.log("");

printDifference(
  independent,
  perDirection,
  "Per-Direction Model"
);

console.log("");

console.log("=== Same-Direction Entry Audit ===");
console.log(`Resolved trades: ${classifiedTrades.length}`);
console.log(`Initial entries: ${initialTrades.length}`);
console.log(`Stacked entries: ${stackedTrades.length}`);
console.log(`Initial-entry R: ${initialR}`);
console.log(`Stacked-entry R: ${stackedR}`);

console.log("");

printMetrics(
  "Initial Same-Direction Entries",
  initialTrades
);

console.log("");

printMetrics(
  "Stacked Same-Direction Entries",
  stackedTrades
);