import type { Candle, SignalCandidate } from "../domain/types.js";

export type TradeOutcome = "WIN" | "LOSS";

export type SimulatedTrade = {
  signal: SignalCandidate;
  entryPrice: number;
  exitPrice: number;
  outcome: TradeOutcome;
  rMultiple: number;
  entryTimestamp: number;
  exitTimestamp: number;
};

export function simulateTrade(
  signal: SignalCandidate,
  candles: Candle[]
): SimulatedTrade | null {
  if (candles.length === 0) {
    return null;
  }

  const entry = signal.entry;
  const stop = signal.stopLoss;
  const firstTakeProfit = signal.takeProfits[0];

  if (firstTakeProfit === undefined) {
    return null;
  }

  const risk = Math.abs(entry - stop);

  if (risk === 0) {
    return null;
  }

  for (const candle of candles) {
    if (signal.direction === "LONG") {
      const stopHit = candle.low <= stop;
      const targetHit = candle.high >= firstTakeProfit;

      // Conservative rule when both are touched in one candle:
      // assume the stop was hit first.
      if (stopHit && targetHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: stop,
          outcome: "LOSS",
          rMultiple: -1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }

      if (stopHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: stop,
          outcome: "LOSS",
          rMultiple: -1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }

      if (targetHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: firstTakeProfit,
          outcome: "WIN",
          rMultiple: 1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }
    }

    if (signal.direction === "SHORT") {
      const stopHit = candle.high >= stop;
      const targetHit = candle.low <= firstTakeProfit;

      if (stopHit && targetHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: stop,
          outcome: "LOSS",
          rMultiple: -1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }

      if (stopHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: stop,
          outcome: "LOSS",
          rMultiple: -1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }

      if (targetHit) {
        return {
          signal,
          entryPrice: entry,
          exitPrice: firstTakeProfit,
          outcome: "WIN",
          rMultiple: 1,
          entryTimestamp: candles[0]?.timestamp ?? candle.timestamp,
          exitTimestamp: candle.timestamp
        };
      }
    }
  }

  return null;
}