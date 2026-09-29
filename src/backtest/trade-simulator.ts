import type { Candle, SignalCandidate } from "../domain/types.js";

export type TradeOutcome =
  | "WIN"
  | "LOSS"
  | "BREAKEVEN";

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
  const [firstTakeProfit, secondTakeProfit] =
    signal.takeProfits;

  if (
    firstTakeProfit === undefined ||
    secondTakeProfit === undefined
  ) {
    return null;
  }

  const risk = Math.abs(entry - stop);

  if (risk === 0) {
    return null;
  }

  const entryTimestamp = candles[0]?.timestamp;

  if (entryTimestamp === undefined) {
    return null;
  }

  let firstTargetHit = false;

  for (const candle of candles) {
    if (signal.direction === "LONG") {
      const stopHit = candle.low <= stop;
      const firstTargetHitThisCandle =
        candle.high >= firstTakeProfit;
      const secondTargetHitThisCandle =
        candle.high >= secondTakeProfit;

      if (!firstTargetHit) {
        if (stopHit) {
          return createTrade(
            signal,
            entry,
            stop,
            "LOSS",
            -1,
            entryTimestamp,
            candle.timestamp
          );
        }

        if (!firstTargetHitThisCandle) {
          continue;
        }

        // Conservative rule:
        // if the stop and target are both touched in
        // the same candle, assume the stop was hit first.
        if (stopHit) {
          return createTrade(
            signal,
            entry,
            stop,
            "LOSS",
            -1,
            entryTimestamp,
            candle.timestamp
          );
        }

        firstTargetHit = true;

        if (secondTargetHitThisCandle) {
          return createTrade(
            signal,
            entry,
            secondTakeProfit,
            "WIN",
            1.5,
            entryTimestamp,
            candle.timestamp
          );
        }

        continue;
      }

      // TP1 has already closed 50% of the position.
      // The remaining 50% is now waiting for TP2 or SL.
      if (stopHit) {
        return createTrade(
          signal,
          entry,
          stop,
          "BREAKEVEN",
          0,
          entryTimestamp,
          candle.timestamp
        );
      }

      if (secondTargetHitThisCandle) {
        return createTrade(
          signal,
          entry,
          secondTakeProfit,
          "WIN",
          1.5,
          entryTimestamp,
          candle.timestamp
        );
      }

      continue;
    }

    const stopHit = candle.high >= stop;
    const firstTargetHitThisCandle =
      candle.low <= firstTakeProfit;
    const secondTargetHitThisCandle =
      candle.low <= secondTakeProfit;

    if (!firstTargetHit) {
      if (stopHit) {
        return createTrade(
          signal,
          entry,
          stop,
          "LOSS",
          -1,
          entryTimestamp,
          candle.timestamp
        );
      }

      if (!firstTargetHitThisCandle) {
        continue;
      }

      // Conservative rule:
      // if the stop and target are both touched in
      // the same candle, assume the stop was hit first.
      if (stopHit) {
        return createTrade(
          signal,
          entry,
          stop,
          "LOSS",
          -1,
          entryTimestamp,
          candle.timestamp
        );
      }

      firstTargetHit = true;

      if (secondTargetHitThisCandle) {
        return createTrade(
          signal,
          entry,
          secondTakeProfit,
          "WIN",
          1.5,
          entryTimestamp,
          candle.timestamp
        );
      }

      continue;
    }

    // TP1 has already closed 50% of the position.
    // The remaining 50% is now waiting for TP2 or SL.
    if (stopHit) {
      return createTrade(
        signal,
        entry,
        stop,
        "BREAKEVEN",
        0,
        entryTimestamp,
        candle.timestamp
      );
    }

    if (secondTargetHitThisCandle) {
      return createTrade(
        signal,
        entry,
        secondTakeProfit,
        "WIN",
        1.5,
        entryTimestamp,
        candle.timestamp
      );
    }
  }

  // TP1 was reached, but the remaining position
  // was not resolved by TP2 or the stop.
  return null;
}

function createTrade(
  signal: SignalCandidate,
  entryPrice: number,
  exitPrice: number,
  outcome: TradeOutcome,
  rMultiple: number,
  entryTimestamp: number,
  exitTimestamp: number
): SimulatedTrade {
  return {
    signal,
    entryPrice,
    exitPrice,
    outcome,
    rMultiple,
    entryTimestamp,
    exitTimestamp
  };
}