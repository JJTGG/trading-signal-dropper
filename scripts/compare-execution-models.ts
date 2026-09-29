import { BinanceHistoricalDataProvider } from "../src/data/providers/binance.js";
import { HistoricalDataLoader } from "../src/data/historical-loader.js";
import {
  simulateTrade,
  type SimulatedTrade
} from "../src/backtest/trade-simulator.js";
import type {
  Candle,
  Direction,
  SignalCandidate
} from "../src/domain/types.js";
import { atr } from "../src/indicators/atr.js";
import { ema } from "../src/indicators/ema.js";
import { EmaBreakoutStrategy } from "../src/strategy/ema-breakout.js";

const CANDLE_COUNT = 2000;
const FAST_EMA_PERIOD = 20;
const SLOW_EMA_PERIOD = 50;
const BREAKOUT_LOOKBACK = 20;
const ATR_PERIOD = 14;
const CANDLE_DURATION_MS = 15 * 60 * 1000;

type GeneratedSignal = {
  signal: SignalCandidate;
  signalTimestamp: number;
  candleIndex: number;
};

type ClassifiedTrade = SimulatedTrade & {
  entryType: "INITIAL" | "STACKED";
};

type TradeObservation = ClassifiedTrade & {
  direction: Direction;
  atr: number;
  emaSeparation: number;
  emaSeparationAtr: number;
  breakoutDistance: number;
  breakoutDistanceAtr: number;
  durationCandles: number;
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

function getEntryIndicators(
  historicalCandles: Candle[],
  candleIndex: number
): {
  atr: number;
  emaSeparation: number;
  breakoutDistance: number;
} {
  const availableCandles = historicalCandles.slice(
    0,
    candleIndex + 1
  );

  const closes = availableCandles.map(
    (candle) => candle.close
  );

  const fastEmaValues = ema(
    closes,
    FAST_EMA_PERIOD
  );

  const slowEmaValues = ema(
    closes,
    SLOW_EMA_PERIOD
  );

  const atrValues = atr(
    availableCandles,
    ATR_PERIOD
  );

  const fastEma = fastEmaValues.at(-1);
  const slowEma = slowEmaValues.at(-1);
  const currentAtr = atrValues.at(-1);
  const currentCandle = availableCandles.at(-1);

  if (
    fastEma === undefined ||
    slowEma === undefined ||
    currentAtr === undefined ||
    currentCandle === undefined
  ) {
    throw new Error(
      `Missing indicator values for entry at ${currentCandle?.timestamp ?? "unknown"}.`
    );
  }

  const breakoutCandles = availableCandles.slice(
    -(BREAKOUT_LOOKBACK + 1),
    -1
  );

  if (breakoutCandles.length === 0) {
    throw new Error(
      `Missing breakout candles for entry at ${currentCandle.timestamp}.`
    );
  }

  const recentHigh = Math.max(
    ...breakoutCandles.map(
      (candle) => candle.high
    )
  );

  const recentLow = Math.min(
    ...breakoutCandles.map(
      (candle) => candle.low
    )
  );

  const direction =
    currentCandle.close > recentHigh
      ? "LONG"
      : currentCandle.close < recentLow
        ? "SHORT"
        : null;

  if (direction === null) {
    throw new Error(
      `Could not determine breakout direction for entry at ${currentCandle.timestamp}.`
    );
  }

  const breakoutDistance =
    direction === "LONG"
      ? currentCandle.close - recentHigh
      : recentLow - currentCandle.close;

  return {
    atr: currentAtr,
    emaSeparation: Math.abs(
      fastEma - slowEma
    ),
    breakoutDistance
  };
}

function observeTrades(
  historicalCandles: Candle[],
  classifiedTrades: ClassifiedTrade[]
): TradeObservation[] {
  return classifiedTrades.map((trade) => {
    const candleIndex =
      historicalCandles.findIndex(
        (candle) =>
          candle.timestamp === trade.entryTimestamp
      );

    if (candleIndex < 0) {
      throw new Error(
        `Could not locate entry candle for ${trade.entryTimestamp}.`
      );
    }

    const {
      atr: currentAtr,
      emaSeparation,
      breakoutDistance
    } = getEntryIndicators(
      historicalCandles,
      candleIndex
    );

    const durationMilliseconds =
      trade.exitTimestamp - trade.entryTimestamp;

    const durationCandles =
      durationMilliseconds /
      CANDLE_DURATION_MS;

    return {
      ...trade,
      direction: trade.signal.direction,
      atr: currentAtr,
      emaSeparation,
      emaSeparationAtr:
        emaSeparation / currentAtr,
      breakoutDistance,
      breakoutDistanceAtr:
        breakoutDistance / currentAtr,
      durationCandles
    };
  });
}

function printSummary(
  name: string,
  trades: TradeObservation[]
): void {
  const totalR = trades.reduce(
    (total, trade) => total + trade.rMultiple,
    0
  );

  const wins = trades.filter(
    (trade) => trade.rMultiple > 0
  ).length;

  const losses = trades.filter(
    (trade) => trade.rMultiple < 0
  ).length;

  const averageR =
    trades.length === 0
      ? 0
      : totalR / trades.length;

  const winRate =
    trades.length === 0
      ? 0
      : wins / trades.length;

  const grossProfit = trades
    .filter((trade) => trade.rMultiple > 0)
    .reduce(
      (total, trade) => total + trade.rMultiple,
      0
    );

  const grossLoss = Math.abs(
    trades
      .filter((trade) => trade.rMultiple < 0)
      .reduce(
        (total, trade) => total + trade.rMultiple,
        0
      )
  );

  const profitFactor =
    grossLoss === 0
      ? grossProfit > 0
        ? Infinity
        : 0
      : grossProfit / grossLoss;

  const averageAtr =
    trades.length === 0
      ? 0
      : trades.reduce(
          (total, trade) => total + trade.atr,
          0
        ) / trades.length;

  const averageEmaSeparationAtr =
    trades.length === 0
      ? 0
      : trades.reduce(
          (total, trade) =>
            total + trade.emaSeparationAtr,
          0
        ) / trades.length;

  const averageBreakoutDistanceAtr =
    trades.length === 0
      ? 0
      : trades.reduce(
          (total, trade) =>
            total + trade.breakoutDistanceAtr,
          0
        ) / trades.length;

  const averageDuration =
    trades.length === 0
      ? 0
      : trades.reduce(
          (total, trade) =>
            total + trade.durationCandles,
          0
        ) / trades.length;

  console.log(`=== ${name} ===`);
  console.log(`Trades: ${trades.length}`);
  console.log(`Wins: ${wins}`);
  console.log(`Losses: ${losses}`);
  console.log(`Total R: ${totalR}`);
  console.log(`Average R: ${averageR}`);
  console.log(`Win rate: ${winRate}`);
  console.log(`Profit factor: ${profitFactor}`);
  console.log(
    `Average ATR: ${averageAtr}`
  );
  console.log(
    `Average EMA separation / ATR: ${averageEmaSeparationAtr}`
  );
  console.log(
    `Average breakout distance / ATR: ${averageBreakoutDistanceAtr}`
  );
  console.log(
    `Average duration: ${averageDuration} candles`
  );
}

function printDirectionBreakdown(
  trades: TradeObservation[]
): void {
  const longTrades = trades.filter(
    (trade) => trade.direction === "LONG"
  );

  const shortTrades = trades.filter(
    (trade) => trade.direction === "SHORT"
  );

  console.log("");

  printSummary("LONG", longTrades);

  console.log("");

  printSummary("SHORT", shortTrades);
}

function printEntryTypeBreakdown(
  trades: TradeObservation[]
): void {
  const initialTrades = trades.filter(
    (trade) => trade.entryType === "INITIAL"
  );

  const stackedTrades = trades.filter(
    (trade) => trade.entryType === "STACKED"
  );

  console.log("");

  printSummary(
    "INITIAL ENTRIES",
    initialTrades
  );

  console.log("");

  printSummary(
    "STACKED ENTRIES",
    stackedTrades
  );

  console.log("");

  printSummary(
    "INITIAL LONG",
    initialTrades.filter(
      (trade) => trade.direction === "LONG"
    )
  );

  console.log("");

  printSummary(
    "INITIAL SHORT",
    initialTrades.filter(
      (trade) => trade.direction === "SHORT"
    )
  );

  console.log("");

  printSummary(
    "STACKED LONG",
    stackedTrades.filter(
      (trade) => trade.direction === "LONG"
    )
  );

  console.log("");

  printSummary(
    "STACKED SHORT",
    stackedTrades.filter(
      (trade) => trade.direction === "SHORT"
    )
  );
}

const signals = generateSignals(candles);

const resolvedTrades: SimulatedTrade[] = [];

for (const generated of signals) {
  const trade = simulateGeneratedSignal(
    candles,
    generated
  );

  if (trade !== null) {
    resolvedTrades.push(trade);
  }
}

const classifiedTrades =
  classifySameDirectionTrades(
    resolvedTrades
  );

const observations = observeTrades(
  candles,
  classifiedTrades
);

const initialTrades = observations.filter(
  (trade) => trade.entryType === "INITIAL"
);

const stackedTrades = observations.filter(
  (trade) => trade.entryType === "STACKED"
);

console.log("=== Entry Condition Audit ===");
console.log(`Candles: ${candles.length}`);
console.log(
  `Range: ${new Date(
    candles[0]?.timestamp ?? 0
  ).toISOString()} → ${new Date(
    candles.at(-1)?.timestamp ?? 0
  ).toISOString()}`
);
console.log(
  `Generated signals: ${signals.length}`
);
console.log(
  `Resolved trades: ${observations.length}`
);
console.log(
  `Unresolved signals: ${
    signals.length - resolvedTrades.length
  }`
);
console.log(
  `Initial entries: ${initialTrades.length}`
);
console.log(
  `Stacked entries: ${stackedTrades.length}`
);

console.log("");

printSummary(
  "ALL RESOLVED TRADES",
  observations
);

printEntryTypeBreakdown(observations);

console.log("");

console.log("=== Direction Breakdown ===");

printDirectionBreakdown(observations);

console.log("");

console.log("=== Initial vs Stacked by Direction ===");

console.log(
  `Initial LONG: ${
    initialTrades.filter(
      (trade) => trade.direction === "LONG"
    ).length
  }`
);

console.log(
  `Initial SHORT: ${
    initialTrades.filter(
      (trade) => trade.direction === "SHORT"
    ).length
  }`
);

console.log(
  `Stacked LONG: ${
    stackedTrades.filter(
      (trade) => trade.direction === "LONG"
    ).length
  }`
);

console.log(
  `Stacked SHORT: ${
    stackedTrades.filter(
      (trade) => trade.direction === "SHORT"
    ).length
  }`
);