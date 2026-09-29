import type {
  Candle,
  SignalCandidate
} from "../domain/types.js";
import type { Strategy } from "../strategy/strategy.js";
import {
  simulateTrade,
  type SimulatedTrade
} from "./trade-simulator.js";

export type UnresolvedSignal = {
  signal: SignalCandidate;
  signalTimestamp: number;
};

export type BacktestResult = {
  trades: SimulatedTrade[];
  unresolvedSignals: UnresolvedSignal[];
};

export function runBacktest(
  candles: Candle[],
  strategy: Strategy
): BacktestResult {
  const trades: SimulatedTrade[] = [];
  const unresolvedSignals: UnresolvedSignal[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const availableCandles = candles.slice(0, i + 1);

    const signal = strategy.evaluate(availableCandles);

    if (signal === null) {
      continue;
    }

    const futureCandles = candles.slice(i + 1);

    const trade = simulateTrade(
      signal,
      futureCandles
    );

    if (trade === null) {
      const signalTimestamp = candles[i]?.timestamp;

      if (signalTimestamp === undefined) {
        throw new Error(
          "Signal candle is missing a timestamp."
        );
      }

      unresolvedSignals.push({
        signal,
        signalTimestamp
      });

      continue;
    }

    trades.push({
      ...trade,
      entryTimestamp:
        candles[i]?.timestamp ??
        trade.entryTimestamp
    });
  }

  return {
    trades,
    unresolvedSignals
  };
}