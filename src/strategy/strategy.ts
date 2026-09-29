import type { Candle, SignalCandidate } from "../domain/types.js";

export interface Strategy {
  readonly name: string;

  evaluate(candles: Candle[]): SignalCandidate | null;
}