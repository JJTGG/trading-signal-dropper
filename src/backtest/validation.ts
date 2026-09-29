import type { Candle } from "../domain/types.js";
import { runBacktest, type BacktestResult } from "./backtester.js";
import {
  calculateMetrics,
  type PerformanceMetrics
} from "./metrics.js";
import type { Strategy } from "../strategy/strategy.js";

export type ValidationResult = {
  candles: number;
  backtest: BacktestResult;
  metrics: PerformanceMetrics;
};

export function validateStrategy(
  candles: Candle[],
  strategy: Strategy
): ValidationResult {
  const backtest = runBacktest(candles, strategy);
  const metrics = calculateMetrics(backtest.trades);

  return {
    candles: candles.length,
    backtest,
    metrics
  };
}