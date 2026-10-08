export interface SignalCheckpointStore {
  get(
    symbol: string,
    timeframe: string
  ): number | undefined;

  save(
    symbol: string,
    timeframe: string,
    candleTimestamp: number
  ): void;
}

function createKey(
  symbol: string,
  timeframe: string
): string {
  return `${symbol.toUpperCase()}:${timeframe}`;
}

export class InMemorySignalCheckpointStore
  implements SignalCheckpointStore
{
  private readonly checkpoints =
    new Map<string, number>();

  get(
    symbol: string,
    timeframe: string
  ): number | undefined {
    return this.checkpoints.get(
      createKey(symbol, timeframe)
    );
  }

  save(
    symbol: string,
    timeframe: string,
    candleTimestamp: number
  ): void {
    if (
      !Number.isSafeInteger(candleTimestamp) ||
      candleTimestamp < 0
    ) {
      throw new Error(
        "Candle timestamp must be a valid non-negative integer."
      );
    }

    this.checkpoints.set(
      createKey(symbol, timeframe),
      candleTimestamp
    );
  }
}