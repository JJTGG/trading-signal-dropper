export type Direction = "LONG" | "SHORT";

export type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type SignalCandidate = {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfits: number[];
  strategy: string;
  timeframe: string;
  reason: string;
};