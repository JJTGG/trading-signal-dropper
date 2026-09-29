import type { Candle, SignalCandidate } from "../domain/types.js";
import { atr } from "../indicators/atr.js";
import { ema } from "../indicators/ema.js";
import type { Strategy } from "./strategy.js";

export type EmaBreakoutConfig = {
  timeframe: string;
  fastEmaPeriod: number;
  slowEmaPeriod: number;
  breakoutLookback: number;
  atrPeriod: number;
  stopAtrMultiplier: number;
  takeProfitRMultiples: number[];
};

const DEFAULT_CONFIG: EmaBreakoutConfig = {
  timeframe: "15m",
  fastEmaPeriod: 20,
  slowEmaPeriod: 50,
  breakoutLookback: 20,
  atrPeriod: 14,
  stopAtrMultiplier: 1.5,
  takeProfitRMultiples: [1, 2]
};

export class EmaBreakoutStrategy implements Strategy {
  readonly name = "EMA Trend + Breakout";

  private readonly config: EmaBreakoutConfig;

  constructor(config: Partial<EmaBreakoutConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
  }

  evaluate(candles: Candle[]): SignalCandidate | null {
    const {
      fastEmaPeriod,
      slowEmaPeriod,
      breakoutLookback,
      atrPeriod,
      stopAtrMultiplier,
      takeProfitRMultiples,
      timeframe
    } = this.config;

    const minimumCandles = Math.max(
      slowEmaPeriod,
      atrPeriod,
      breakoutLookback + 1
    );

    if (candles.length < minimumCandles) {
      return null;
    }

    const closes = candles.map((candle) => candle.close);

    const fastEmaValues = ema(closes, fastEmaPeriod);
    const slowEmaValues = ema(closes, slowEmaPeriod);
    const atrValues = atr(candles, atrPeriod);

    const fastEma = fastEmaValues.at(-1);
    const slowEma = slowEmaValues.at(-1);
    const currentAtr = atrValues.at(-1);
    const currentCandle = candles.at(-1);
    const previousCandle = candles.at(-2);

    if (
      fastEma === undefined ||
      slowEma === undefined ||
      currentAtr === undefined ||
      currentCandle === undefined ||
      previousCandle === undefined
    ) {
      return null;
    }

    if (currentAtr <= 0) {
      return null;
    }

    const breakoutCandles = candles.slice(
      -(breakoutLookback + 1),
      -1
    );

    const recentHigh = Math.max(
      ...breakoutCandles.map((candle) => candle.high)
    );

    const recentLow = Math.min(
      ...breakoutCandles.map((candle) => candle.low)
    );

    const isBullishTrend = fastEma > slowEma;
    const isBearishTrend = fastEma < slowEma;

    const bullishBreakout =
      currentCandle.close > recentHigh &&
      previousCandle.close <= recentHigh;

    const bearishBreakout =
      currentCandle.close < recentLow &&
      previousCandle.close >= recentLow;

    if (isBullishTrend && bullishBreakout) {
      return this.createLongSignal(
        currentCandle,
        currentAtr,
        timeframe,
        takeProfitRMultiples,
        stopAtrMultiplier
      );
    }

    if (isBearishTrend && bearishBreakout) {
      return this.createShortSignal(
        currentCandle,
        currentAtr,
        timeframe,
        takeProfitRMultiples,
        stopAtrMultiplier
      );
    }

    return null;
  }

  private createLongSignal(
    candle: Candle,
    currentAtr: number,
    timeframe: string,
    takeProfitRMultiples: number[],
    stopAtrMultiplier: number
  ): SignalCandidate {
    const entry = candle.close;
    const risk = currentAtr * stopAtrMultiplier;
    const stopLoss = entry - risk;

    return {
      direction: "LONG",
      entry,
      stopLoss,
      takeProfits: takeProfitRMultiples.map(
        (multiple) => entry + risk * multiple
      ),
      strategy: this.name,
      timeframe,
      reason:
        "Fast EMA is above slow EMA and price confirmed an upside breakout."
    };
  }

  private createShortSignal(
    candle: Candle,
    currentAtr: number,
    timeframe: string,
    takeProfitRMultiples: number[],
    stopAtrMultiplier: number
  ): SignalCandidate {
    const entry = candle.close;
    const risk = currentAtr * stopAtrMultiplier;
    const stopLoss = entry + risk;

    return {
      direction: "SHORT",
      entry,
      stopLoss,
      takeProfits: takeProfitRMultiples.map(
        (multiple) => entry - risk * multiple
      ),
      strategy: this.name,
      timeframe,
      reason:
        "Fast EMA is below slow EMA and price confirmed a downside breakout."
    };
  }
}