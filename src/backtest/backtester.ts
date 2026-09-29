import type { Candle } from "../domain/types.js";
import type { Strategy } from "../strategy/strategy.js";
import {
  simulateTrade,
  type SimulatedTrade
} from "./trade-simulator.js";

export type BacktestResult = {
  trades: SimulatedTrade[];
};

export function runBacktest(
  candles: Candle[],
  strategy: Strategy
): BacktestResult {
  const trades: SimulatedTrade[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const availableCandles = candles.slice(0, i + 1);

    const signal = strategy.evaluate(availableCandles);

    if (signal === null) {
      continue;
    }

    const futureCandles = candles.slice(i + 1);

    const trade = simulateTrade(signal, futureCandles);

    if (trade !== null) {
      trades.push({
        ...trade,
        entryTimestamp: candles[i]?.timestamp ?? trade.entryTimestamp
      });
    }
  }

  return {
    trades
  };
}