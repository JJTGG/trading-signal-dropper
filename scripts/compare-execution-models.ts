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

type ActivePosition = {
  direction: Direction;
  exitTimestamp: number;
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

  const activePositions = new Map<
    Direction,
    ActivePosition
  >();

  for (const generated of signals) {
    const direction = generated.signal.direction;
    const activePosition = activePositions.get(direction);

    if (
      activePosition !== undefined &&
      generated.signalTimestamp < activePosition.exitTimestamp
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
        activePositions.set(direction, {
          direction,
          exitTimestamp: finalTimestamp
        });
      }

      continue;
    }

    trades.push(trade);

    activePositions.set(direction, {
      direction,
      exitTimestamp: trade.exitTimestamp
    });
  }

  return {
    trades,
    unresolvedSignals,
    skippedSignals,
    metrics: calculateMetrics(trades)
  };
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function printModel(
  name: string,
  audit: ExecutionAudit
): void {
  console.log(`=== ${name} ===`);
  console.log(`Executed trades: ${audit.trades.length}`);
  console.log(
    `Unresolved signals: ${audit.unresolvedSignals.length}`
  );
  console.log(
    `Skipped signals: ${audit.skippedSignals.length}`
  );
  console.log(`Total R: ${audit.metrics.totalR}`);
  console.log(
    `Average R: ${audit.metrics.averageR}`
  );
  console.log(
    `Win rate: ${audit.metrics.winRate}`
  );
  console.log(
    `Profit factor: ${audit.metrics.profitFactor}`
  );
  console.log(
    `Maximum drawdown: ${audit.metrics.maximumDrawdown}R`
  );
  console.log(
    `Largest winning trade: ${audit.metrics.largestWinningTrade}R`
  );
  console.log(
    `Largest losing trade: ${audit.metrics.largestLosingTrade}R`
  );
  console.log(
    `Longest winning streak: ${audit.metrics.longestWinningStreak}`
  );
  console.log(
    `Longest losing streak: ${audit.metrics.longestLosingStreak}`
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

const longSignals = signals.filter(
  ({ signal }) => signal.direction === "LONG"
).length;

const shortSignals = signals.filter(
  ({ signal }) => signal.direction === "SHORT"
).length;

console.log("=== Execution Model Audit ===");
console.log(`Candles: ${candles.length}`);
console.log(
  `Range: ${formatTimestamp(candles[0]?.timestamp ?? 0)} → ${formatTimestamp(candles.at(-1)?.timestamp ?? 0)}`
);
console.log(`Generated signals: ${signals.length}`);
console.log(`LONG signals: ${longSignals}`);
console.log(`SHORT signals: ${shortSignals}`);

console.log("");

printModel(
  "Independent Execution",
  independent
);

console.log("");

printModel(
  "Single-Position Execution",
  singlePosition
);

console.log("");

printModel(
  "One-Position-Per-Direction Execution",
  perDirection
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

console.log("=== Per-Direction Skips ===");

for (const skipped of perDirection.skippedSignals) {
  console.log(
    `${formatTimestamp(skipped.signalTimestamp)} | ` +
      `${skipped.signal.direction} | ` +
      `entry=${skipped.signal.entry}`
  );
}